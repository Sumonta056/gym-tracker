'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

import {
  addSet,
  deleteSet,
  finishSession,
  getPlanCursor,
  getProfile,
  lastSetFor,
  listSets,
  restoreSet,
  setPlanCursor,
  setRestSeconds,
  setsForExercises,
  SignedOutOnThisDevice,
  updateSet,
} from '../../lib/db/repository'
import { sessionSummary, stepResults, stepStatuses } from '../../lib/metrics/planProgress'
import { sessionStats } from '../../lib/metrics/sessionStats'
import { combinePlans, stepGroups } from '../../lib/plans'
import { restSecondsFor } from '../../lib/workout/restTimer'
import { Card } from '../ui/Card'
import { useFocusMode } from '../ui/FocusMode'
import { SAVED_MESSAGE, useToast } from '../ui/Toast'
import { EditSetSheet } from '../workout/EditSetSheet'
import { draftFrom } from '../workout/ExerciseCard'
import { lastOf, READ_FAILED, REPOSITORY_LIVE_SOURCE } from '../workout/LiveSession'
import { createRestAlert } from '../workout/restAlert'
import { RestTimerCard } from '../workout/RestTimerCard'
import { RestTimeSheet } from '../workout/RestTimeSheet'
import { systemNow } from '../workout/SessionTimer'
import { ToastRoom, UndoToast } from '../workout/UndoToast'
import { WORKOUTS_PATH } from '../workouts/historyText'

import { FinishConfirmSheet } from './FinishConfirmSheet'
import { MuscleTags } from './MuscleTags'
import { PlanSessionDone } from './PlanSessionDone'
import { lastTimeLine, PlanSetRows } from './PlanSetRows'
import { PlanStepHeader } from './PlanStepHeader'
import { targetText } from './planText'
import { StepFooter } from './StepFooter'
import { StepFrame } from './StepFrame'
import { StepListPanel } from './StepListPanel'
import { StepListSheet } from './StepListSheet'
import { StepProgress } from './StepProgress'
import { WatchPill } from './WatchPill'

import type { NotDoneStep } from './FinishConfirmSheet'
import type { PlanCursor, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
import type { WorkoutSetPatch } from '../../lib/db/repository'
import type { PlanSessionSummary, StepResult, StepStatus } from '../../lib/metrics/planProgress'
import type { SessionStats } from '../../lib/metrics/sessionStats'
import type { PlanStep } from '../../lib/schema/plan'
import type { UnitSystem } from '../../lib/schema/profile'
import type { EditingSet } from '../workout/EditSetSheet'
import type { DraftText, SetValues } from '../workout/ExerciseCard'
import type { RestSettings } from '../workout/LiveSession'
import type { RestAlert } from '../workout/restAlert'
import type { ChangingRest } from '../workout/RestTimeSheet'
import type { Toast } from '../workout/UndoToast'

export type PlanSessionSource = {
  listSets: (sessionId: string) => Promise<WorkoutSet[]>
  getPlanCursor: (sessionId: string) => Promise<PlanCursor | undefined>
  setPlanCursor: (cursor: PlanCursor) => Promise<void>
  lastSetFor: (exerciseId: string) => Promise<WorkoutSet | undefined>
  setsForExercises: (exerciseIds: string[]) => Promise<WorkoutSet[]>
  addSet: typeof addSet
  updateSet: (id: string, patch: WorkoutSetPatch) => Promise<WorkoutSet>
  deleteSet: (id: string) => Promise<void>
  restoreSet: (id: string) => Promise<void>
  finishSession: (id: string) => Promise<WorkoutSession>
  readUnit: () => Promise<UnitSystem>
  readRest: () => Promise<RestSettings>
  saveRestSeconds: (exerciseId: string, seconds: number) => Promise<unknown>
}

export const REPOSITORY_PLAN_SOURCE: PlanSessionSource = {
  listSets,
  getPlanCursor,
  setPlanCursor,
  lastSetFor,
  setsForExercises,
  addSet,
  updateSet,
  deleteSet,
  restoreSet,
  finishSession,
  readUnit: async () => (await getProfile()).unit_system,
  readRest: REPOSITORY_LIVE_SOURCE.readRest,
  saveRestSeconds: setRestSeconds,
}

export const MOVE_FAILED = 'The step could not be saved on this device.'

export const SAVE_FAILED = 'The set could not be saved on this device.'

export const EDIT_FAILED = 'The set could not be changed on this device.'

export const DELETE_FAILED = 'The set could not be removed on this device.'

export const UNDO_FAILED = 'The set could not be brought back on this device.'

export const FINISH_FAILED = 'The session could not be finished on this device.'

export const REST_SAVE_FAILED = 'The rest time could not be saved on this device.'

export const READING_STEP = 'Reading the last set…'

type RestTweak = { setId: string; taps: number; skipped: boolean; frozen: number | null }

type Snapshot = {
  sets: WorkoutSet[]
  cursor: PlanCursor
  unit: UnitSystem
  rest: RestSettings
}

type Finished = { stats: SessionStats; summary: PlanSessionSummary; results: StepResult[] }

type ReadState =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; snapshot: Snapshot }

function failure(cause: unknown, fallback: string): string {
  return cause instanceof SignedOutOnThisDevice ? cause.message : fallback
}

function liveSetsOf(sets: readonly WorkoutSet[], exerciseId: string): WorkoutSet[] {
  return sets.filter((set) => set.exercise_id === exerciseId && set.deleted_at === null)
}

export function resumeIndex(steps: readonly PlanStep[], sets: readonly WorkoutSet[]): number {
  const open = steps.findIndex((step) => liveSetsOf(sets, step.exerciseId).length === 0)

  return open === -1 ? Math.max(0, steps.length - 1) : open
}

export function startCursor(
  sessionId: string,
  steps: readonly PlanStep[],
  sets: readonly WorkoutSet[],
  saved: PlanCursor | undefined,
): PlanCursor {
  if (saved === undefined) {
    return { sessionId, stepIndex: resumeIndex(steps, sets), skipped: [] }
  }

  const last = Math.max(0, steps.length - 1)

  return { ...saved, stepIndex: Math.min(Math.max(0, saved.stepIndex), last) }
}

export function shownStatuses(
  steps: PlanStep[],
  sets: WorkoutSet[],
  cursor: PlanCursor,
): StepStatus[] {
  return stepStatuses(steps, sets, cursor).map((status, index) =>
    index === cursor.stepIndex ? 'now' : status,
  )
}

export function notDoneSteps(
  steps: PlanStep[],
  sets: WorkoutSet[],
  cursor: PlanCursor,
): NotDoneStep[] {
  return stepStatuses(steps, sets, cursor).flatMap((status, index) =>
    status === 'done' ? [] : [{ index, name: steps[index]?.name ?? '', status }],
  )
}

export function firstDraft(
  step: Pick<PlanStep, 'target' | 'bodyweight'>,
  previous: WorkoutSet | undefined,
  unit: UnitSystem,
): DraftText {
  if (previous === undefined) return { reps: String(step.target.repsMin), load: '' }

  const copy = draftFrom(previous, unit)

  return step.bodyweight ? { ...copy, load: '' } : copy
}

export function startDrafts(
  step: Pick<PlanStep, 'target' | 'bodyweight'>,
  logged: number,
  previous: WorkoutSet | undefined,
  unit: UnitSystem,
): DraftText[] {
  const count = Math.max(0, step.target.sets - logged)

  return Array.from({ length: count }, () => firstDraft(step, previous, unit))
}

export function skipStep(cursor: PlanCursor, slug: string, last: number): PlanCursor {
  return {
    ...cursor,
    stepIndex: Math.min(cursor.stepIndex + 1, last),
    skipped: cursor.skipped.includes(slug) ? cursor.skipped : [...cursor.skipped, slug],
  }
}

async function readSnapshot(
  source: PlanSessionSource,
  session: WorkoutSession,
  steps: PlanStep[],
): Promise<Snapshot> {
  const [sets, saved, unit, rest] = await Promise.all([
    source.listSets(session.id),
    source.getPlanCursor(session.id),
    source.readUnit(),
    source.readRest(),
  ])

  return { sets, cursor: startCursor(session.id, steps, sets, saved), unit, rest }
}

export type PlanSessionProps = {
  session: WorkoutSession
  source?: PlanSessionSource
  now?: () => Date
  alert?: RestAlert
}

export function PlanSession({
  session,
  source = REPOSITORY_PLAN_SOURCE,
  now = systemNow,
  alert,
}: PlanSessionProps) {
  const [plan] = useState(() => combinePlans(session.plan_ids ?? []))
  const [groups] = useState(() => stepGroups(session.plan_ids ?? []))
  const [read, setRead] = useState<ReadState>({ status: 'loading' })
  const [previous, setPrevious] = useState<ReadonlyMap<string, WorkoutSet | null>>(new Map())
  const [drafts, setDrafts] = useState<ReadonlyMap<string, DraftText[]>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingSet | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [toast, setToast] = useState<(Toast & { setId: string }) | null>(null)
  const [restTweak, setRestTweak] = useState<RestTweak | null>(null)
  const [changingRest, setChangingRest] = useState<ChangingRest | null>(null)
  const [restBusy, setRestBusy] = useState(false)
  const [restError, setRestError] = useState<string | null>(null)
  const [finished, setFinished] = useState<Finished | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const alertRef = useRef<RestAlert | null>(alert ?? null)
  const deletes = useRef(0)
  const alive = useRef(true)
  const savedToast = useToast()
  const nameId = useId()

  useFocusMode(finished === null)

  const refreshSets = useCallback(async () => {
    const sets = await source.listSets(session.id)

    if (alive.current) {
      setRead((held) =>
        held.status === 'ready' ? { status: 'ready', snapshot: { ...held.snapshot, sets } } : held,
      )
    }
  }, [source, session.id])

  useEffect(() => {
    alive.current = true
    readSnapshot(source, session, plan.steps).then(
      (snapshot) => {
        if (alive.current) setRead({ status: 'ready', snapshot })
      },
      () => {
        if (alive.current) setRead({ status: 'failed' })
      },
    )

    return () => {
      alive.current = false
    }
  }, [source, session, plan.steps])

  const snapshot = read.status === 'ready' ? read.snapshot : null
  const step = snapshot === null ? undefined : plan.steps[snapshot.cursor.stepIndex]
  const needsPrevious = step !== undefined && !previous.has(step.slug)

  useEffect(() => {
    if (step === undefined || !needsPrevious) {
      return
    }

    let live = true
    const keep = (set: WorkoutSet | undefined) => {
      if (live) setPrevious((held) => new Map(held).set(step.slug, set ?? null))
    }

    source.lastSetFor(step.exerciseId).then(keep, () => {
      keep(undefined)
    })

    return () => {
      live = false
    }
  }, [needsPrevious, step, source])

  useEffect(() => {
    if (snapshot === null || step === undefined || needsPrevious || drafts.has(step.slug)) {
      return
    }

    const last = previous.get(step.slug) ?? undefined
    const logged = liveSetsOf(snapshot.sets, step.exerciseId).length

    setDrafts((held) =>
      new Map(held).set(step.slug, startDrafts(step, logged, last, snapshot.unit)),
    )
  }, [snapshot, step, needsPrevious, drafts, previous])

  if (read.status === 'loading') {
    return (
      <p role="status" className="text-muted text-sm">
        Reading this device…
      </p>
    )
  }

  if (read.status === 'failed' || snapshot === null || step === undefined) {
    return (
      <p role="alert" className="text-danger text-sm">
        {READ_FAILED}
      </p>
    )
  }

  const { sets, cursor, unit } = snapshot
  const index = cursor.stepIndex
  const lastIndex = plan.steps.length - 1
  const nextStep = plan.steps[index + 1]
  const stepSets = liveSetsOf(sets, step.exerciseId)
  const stepDrafts = drafts.get(step.slug)
  const last = previous.get(step.slug) ?? undefined
  const nameOf = (exerciseId: string) =>
    plan.steps.find((held) => held.exerciseId === exerciseId)?.name ?? 'Unknown exercise'
  const restAlert = () => {
    alertRef.current ??= createRestAlert()
    return alertRef.current
  }
  const lastSet = lastOf(sets)
  const restSet = lastSet?.completed_at == null ? undefined : lastSet
  const restCompletedAt = restSet?.completed_at ?? null
  const tweak: RestTweak | null =
    restSet === undefined
      ? null
      : restTweak?.setId === restSet.id
        ? restTweak
        : { setId: restSet.id, taps: 0, skipped: false, frozen: null }
  const savedRest =
    restSet === undefined ? 0 : restSecondsFor(snapshot.rest.byExercise, restSet.exercise_id)
  const restBase = tweak?.frozen ?? savedRest
  const restName = restSet === undefined ? '' : nameOf(restSet.exercise_id)
  const changeTweak = (change: (held: RestTweak) => RestTweak) => {
    if (tweak !== null) setRestTweak(change(tweak))
  }
  const setStepDrafts = (change: (held: DraftText[]) => DraftText[]) => {
    setDrafts((held) => new Map(held).set(step.slug, change(held.get(step.slug) ?? [])))
  }

  const move = (next: PlanCursor) => {
    if (busy) return

    setBusy(true)
    setError(null)
    source
      .setPlanCursor(next)
      .then(
        () => {
          setRead((held) =>
            held.status === 'ready'
              ? { status: 'ready', snapshot: { ...held.snapshot, cursor: next } }
              : held,
          )
        },
        (cause: unknown) => {
          setError(failure(cause, MOVE_FAILED))
        },
      )
      .finally(() => {
        setBusy(false)
      })
  }

  const logSet = (draftIndex: number, values: SetValues) => {
    if (busy) return

    restAlert().unlock()
    setBusy(true)
    setError(null)
    source
      .addSet({
        session_id: session.id,
        exercise_id: step.exerciseId,
        reps: values.reps,
        weight_kg: values.weight_kg,
        completed_at: now().toISOString(),
      })
      .then(
        async () => {
          setStepDrafts((held) => held.filter((_, position) => position !== draftIndex))
          await refreshSets()
        },
        (cause: unknown) => {
          setError(failure(cause, SAVE_FAILED))
        },
      )
      .finally(() => {
        setBusy(false)
      })
  }

  const addRow = () => {
    setStepDrafts((held) => {
      const above = held.at(-1)
      const logged = stepSets.at(-1)
      const copy =
        above !== undefined
          ? { ...above }
          : logged !== undefined
            ? draftFrom(logged, unit)
            : firstDraft(step, last, unit)

      return [...held, copy]
    })
  }

  const removeSet = (set: WorkoutSet, position: number) => {
    if (busy) return

    const fromSheet = editing !== null

    setBusy(true)
    setError(null)
    setEditError(null)
    source
      .deleteSet(set.id)
      .then(
        async () => {
          deletes.current += 1
          setEditing(null)
          setToast({
            key: `${set.id}:${String(deletes.current)}`,
            message: `Set ${String(position)} removed.`,
            setId: set.id,
          })
          await refreshSets()
        },
        (cause: unknown) => {
          const message = failure(cause, DELETE_FAILED)
          if (fromSheet) setEditError(message)
          else setError(message)
        },
      )
      .finally(() => {
        setBusy(false)
      })
  }

  const undo = () => {
    if (toast === null) return

    const { setId } = toast

    setToast(null)
    setError(null)
    source.restoreSet(setId).then(
      async () => {
        await refreshSets()
      },
      (cause: unknown) => {
        setError(failure(cause, UNDO_FAILED))
      },
    )
  }

  const saveEdit = (values: SetValues) => {
    if (editing === null || busy) return

    setBusy(true)
    setEditError(null)
    source
      .updateSet(editing.set.id, { reps: values.reps, weight_kg: values.weight_kg })
      .then(
        async () => {
          setEditing(null)
          savedToast.show(SAVED_MESSAGE)
          await refreshSets()
        },
        (cause: unknown) => {
          setEditError(failure(cause, EDIT_FAILED))
        },
      )
      .finally(() => {
        setBusy(false)
      })
  }

  const saveRest = (seconds: number) => {
    if (changingRest === null || restBusy) return

    const { exerciseId } = changingRest
    const frozen = restSet?.exercise_id === exerciseId ? restBase : null

    setRestBusy(true)
    setRestError(null)
    source
      .saveRestSeconds(exerciseId, seconds)
      .then(
        async () => {
          if (frozen !== null) {
            changeTweak((held) => ({ ...held, frozen: held.frozen ?? frozen }))
          }
          setChangingRest(null)
          savedToast.show(SAVED_MESSAGE)
          const rest = await source.readRest()
          setRead((held) =>
            held.status === 'ready'
              ? { status: 'ready', snapshot: { ...held.snapshot, rest } }
              : held,
          )
        },
        (cause: unknown) => {
          setRestError(failure(cause, REST_SAVE_FAILED))
        },
      )
      .finally(() => {
        setRestBusy(false)
      })
  }

  const finish = () => {
    if (busy) return

    setConfirming(false)
    setBusy(true)
    setError(null)
    source
      .finishSession(session.id)
      .then(async (finished) => {
        const history = await source.setsForExercises([
          ...new Set(sets.map((set) => set.exercise_id)),
        ])
        setFinished({
          stats: sessionStats(finished, sets, history),
          summary: sessionSummary(plan.steps, sets, cursor),
          results: stepResults(plan.steps, sets, cursor),
        })
      })
      .catch((cause: unknown) => {
        setBusy(false)
        setError(failure(cause, FINISH_FAILED))
      })
  }

  const notDone = notDoneSteps(plan.steps, sets, cursor)
  const liveSetCount = sets.filter((held) => held.deleted_at === null).length
  const askFinish = () => {
    if (busy) return
    if (notDone.length === 0) {
      finish()
      return
    }
    setConfirming(true)
  }

  if (finished !== null) {
    return (
      <PlanSessionDone
        title={plan.title}
        durationSeconds={finished.stats.durationSeconds}
        summary={finished.summary}
        results={finished.results}
        records={finished.stats.newRecords}
        unit={unit}
        nameOf={nameOf}
      />
    )
  }

  const statuses = shownStatuses(plan.steps, sets, cursor)
  const pick = (picked: number) => {
    if (picked !== index) move({ ...cursor, stepIndex: picked })
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 lg:max-w-none">
      <PlanStepHeader
        title={plan.title}
        stepIndex={index}
        total={plan.steps.length}
        startedAt={session.started_at}
        leaveHref={WORKOUTS_PATH}
        now={now}
        busy={busy}
        onBack={() => {
          move({ ...cursor, stepIndex: Math.max(0, index - 1) })
        }}
        onOpenList={() => {
          setListOpen(true)
        }}
        onFinish={askFinish}
      />

      <StepProgress names={plan.steps.map((held) => held.name)} statuses={statuses} />

      <div className="flex flex-col gap-3 lg:-mt-1.5 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-[18px]">
        <StepListPanel
          steps={plan.steps}
          groups={groups}
          statuses={statuses}
          busy={busy}
          onPick={pick}
          className="hidden lg:grid"
        />

        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby={nameId} className="overflow-hidden">
            <StepFrame key={step.slug} step={step} className="-mx-4 -mt-4" />
            <h1
              id={nameId}
              className="text-text mt-3 text-[19px] leading-tight font-bold tracking-[-0.4px] break-words"
            >
              {step.name}
            </h1>
            <p className="text-muted mt-0.5 text-sm font-semibold">
              {targetText(step.target)}
              {last === undefined ? null : (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">. </span>
                  {lastTimeLine(last, unit)}
                </>
              )}
            </p>
            <MuscleTags
              primary={step.muscles.primary}
              secondary={step.muscles.secondary}
              className="mt-2.5"
            />
            {step.video === undefined ? null : (
              <WatchPill name={step.name} video={step.video} className="mt-2.5 bg-transparent" />
            )}
          </Card>

          <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
            {stepDrafts === undefined ? (
              <p role="status" className="text-muted text-sm">
                {READING_STEP}
              </p>
            ) : (
              <PlanSetRows
                key={step.slug}
                name={step.name}
                unit={unit}
                sets={stepSets}
                drafts={stepDrafts}
                previous={last}
                equipment={step.equipment}
                busy={busy}
                onDraftChange={(position, draft) => {
                  setStepDrafts((held) => held.map((row, at) => (at === position ? draft : row)))
                }}
                onLog={logSet}
                onAddRow={addRow}
                onEdit={(set, position) => {
                  setEditError(null)
                  setEditing({ set, position, exerciseName: step.name })
                }}
                onUndo={removeSet}
              />
            )}

            <div className="flex min-w-0 flex-col gap-3">
              {restSet === undefined ||
              restCompletedAt === null ||
              tweak?.skipped === true ? null : (
                <RestTimerCard
                  key={restSet.id}
                  exerciseName={restName}
                  completedAt={restCompletedAt}
                  restSeconds={restBase}
                  savedSeconds={savedRest}
                  extraTaps={tweak?.taps ?? 0}
                  narrow
                  now={now}
                  onZero={() => {
                    restAlert().ring(snapshot.rest.muted)
                  }}
                  onSkip={() => {
                    changeTweak((held) => ({ ...held, skipped: true }))
                  }}
                  onAddThirty={() => {
                    changeTweak((held) => ({ ...held, taps: held.taps + 1 }))
                  }}
                  onChange={() => {
                    setRestError(null)
                    setChangingRest({
                      exerciseId: restSet.exercise_id,
                      exerciseName: restName,
                      seconds: savedRest,
                    })
                  }}
                />
              )}

              <StepFooter
                nextName={nextStep?.name}
                busy={busy}
                onSkip={() => {
                  move(skipStep(cursor, step.slug, lastIndex))
                }}
                onNext={() => {
                  move({ ...cursor, stepIndex: Math.min(index + 1, lastIndex) })
                }}
                onFinish={askFinish}
              />
            </div>
          </div>

          {error === null ? null : (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
        </div>
      </div>

      <ToastRoom shown={toast !== null} />

      <EditSetSheet
        editing={editing}
        unit={unit}
        busy={busy}
        error={editError}
        onSave={saveEdit}
        onDelete={() => {
          if (editing !== null) removeSet(editing.set, editing.position)
        }}
        onClose={() => {
          setEditing(null)
          setEditError(null)
        }}
      />

      <RestTimeSheet
        changing={changingRest}
        busy={restBusy}
        error={restError}
        onSave={saveRest}
        onClose={() => {
          setChangingRest(null)
          setRestError(null)
        }}
      />

      <StepListSheet
        open={listOpen}
        title={plan.title}
        steps={plan.steps}
        groups={groups}
        statuses={statuses}
        onPick={(picked) => {
          setListOpen(false)
          pick(picked)
        }}
        onClose={() => {
          setListOpen(false)
        }}
      />

      <FinishConfirmSheet
        open={confirming}
        notDone={notDone}
        setCount={liveSetCount}
        busy={busy}
        onFinish={finish}
        onClose={() => {
          setConfirming(false)
        }}
      />

      <UndoToast
        toast={toast}
        onUndo={undo}
        onDismiss={() => {
          setToast(null)
        }}
      />
    </div>
  )
}
