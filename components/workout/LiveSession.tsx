'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import {
  addSet,
  deleteSet,
  finishSession,
  getActiveSession,
  getProfile,
  lastSetFor,
  listExercises,
  listSets,
  restoreSet,
  setRestSeconds,
  setsForExercises,
  SignedOutOnThisDevice,
  updateSet,
} from '../../lib/db/repository'
import { toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { earlierThan, isNewRecord } from '../../lib/metrics/personalRecords'
import { volumeLoad } from '../../lib/metrics/volumeLoad'
import { restSecondsFor } from '../../lib/workout/restTimer'
import { formatCount } from '../dashboard/summary'
import { SyncChip } from '../sync/SyncChip'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { HeroCard } from '../ui/HeroCard'
import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'

import { EditSetSheet } from './EditSetSheet'
import { ExerciseCard, lastTimeText } from './ExerciseCard'
import { ExercisePicker } from './ExercisePicker'
import { MUSCLE_GROUP_LABEL } from './MuscleGroupChips'
import { createRestAlert } from './restAlert'
import { RestTimerCard } from './RestTimerCard'
import { RestTimeSheet } from './RestTimeSheet'
import { SessionTimer, startedText, systemNow } from './SessionTimer'
import { ToastRoom, UndoToast } from './UndoToast'

import type { EditingSet } from './EditSetSheet'
import type { SetValues } from './ExerciseCard'
import type { ExerciseSource } from './ExercisePicker'
import type { RestAlert } from './restAlert'
import type { ChangingRest } from './RestTimeSheet'
import type { Toast } from './UndoToast'
import type { Exercise, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
import type { ExerciseFilter, WorkoutSetPatch } from '../../lib/db/repository'
import type { UnitSystem } from '../../lib/schema/profile'

export type LiveSessionSource = {
  getActiveSession: () => Promise<WorkoutSession | undefined>
  listSets: (sessionId: string) => Promise<WorkoutSet[]>
  listExercises: (filter: ExerciseFilter) => Promise<Exercise[]>
  setsForExercises: (exerciseIds: string[]) => Promise<WorkoutSet[]>
  lastSetFor: (exerciseId: string) => Promise<WorkoutSet | undefined>
  addSet: typeof addSet
  updateSet: (id: string, patch: WorkoutSetPatch) => Promise<WorkoutSet>
  deleteSet: (id: string) => Promise<void>
  restoreSet: (id: string) => Promise<void>
  finishSession: (id: string) => Promise<WorkoutSession>
  readUnit: () => Promise<UnitSystem>
  readRest: () => Promise<RestSettings>
  saveRestSeconds: (exerciseId: string, seconds: number) => Promise<unknown>
}

export type RestSettings = {
  muted: boolean
  byExercise: Readonly<Record<string, number>>
}

type RestTweak = {
  setId: string
  taps: number
  skipped: boolean
  frozen: number | null
}

export const REPOSITORY_LIVE_SOURCE: LiveSessionSource = {
  getActiveSession,
  listSets,
  listExercises,
  setsForExercises,
  lastSetFor,
  addSet,
  updateSet,
  deleteSet,
  restoreSet,
  finishSession,
  readUnit: async () => (await getProfile()).unit_system,
  readRest: async () => {
    const profile = await getProfile()

    return {
      muted: profile.rest_sound_muted ?? false,
      byExercise: profile.rest_seconds_by_exercise ?? {},
    }
  },
  saveRestSeconds: setRestSeconds,
}

export const READ_FAILED = 'The session could not be read on this device.'

export const SAVE_FAILED = 'The set could not be saved on this device.'

export const FINISH_FAILED = 'The session could not be finished on this device.'

export const EDIT_FAILED = 'The set could not be changed on this device.'

export const DELETE_FAILED = 'The set could not be deleted on this device.'

export const UNDO_FAILED = 'The set could not be brought back on this device.'

export const REST_SAVE_FAILED = 'The rest time could not be saved on this device.'

export const WORKOUTS_PATH = '/workouts'

type Snapshot = {
  session: WorkoutSession
  sets: WorkoutSet[]
  history: WorkoutSet[]
  exercises: Map<string, Exercise>
  unit: UnitSystem
  rest: RestSettings
}

type ReadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'none' }
  | { status: 'ready'; snapshot: Snapshot }

export function recordIds(
  sets: readonly WorkoutSet[],
  history: readonly WorkoutSet[],
): Set<string> {
  return new Set(sets.filter((set) => isNewRecord(set, history)).map((set) => set.id))
}

export function exerciseOrder(sets: readonly WorkoutSet[], extra: readonly string[]): string[] {
  return [...new Set([...sets.map((set) => set.exercise_id), ...extra])]
}

export function lastOf(sets: readonly WorkoutSet[]): WorkoutSet | undefined {
  return [...sets].sort((left, right) => (earlierThan(left, right) ? -1 : 1)).at(-1)
}

export function lastTimeSet(
  history: readonly WorkoutSet[],
  sessionId: string,
  exerciseId: string,
): WorkoutSet | undefined {
  return lastOf(
    history.filter((set) => set.exercise_id === exerciseId && set.session_id !== sessionId),
  )
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`
}

export function volumeText(sets: readonly WorkoutSet[], unit: UnitSystem): string {
  return `${formatCount(Math.round(toDisplayWeight(volumeLoad(sets), unit)))} ${weightSymbol(unit)}`
}

export function heroFooter(sets: readonly WorkoutSet[], unit: UnitSystem): string {
  const exercises = new Set(sets.map((set) => set.exercise_id)).size

  return `Volume ${volumeText(sets, unit)} · ${plural(sets.length, 'set')} · ${plural(exercises, 'exercise')}`
}

export function exerciseSummary(sets: readonly WorkoutSet[], unit: UnitSystem): string {
  return sets.length === 0 ? 'No sets' : `${plural(sets.length, 'set')} · ${volumeText(sets, unit)}`
}

function failure(cause: unknown, fallback: string): string {
  return cause instanceof SignedOutOnThisDevice ? cause.message : fallback
}

async function readSnapshot(source: LiveSessionSource): Promise<Snapshot | null> {
  const session = await source.getActiveSession()

  if (session === undefined) {
    return null
  }

  const [sets, catalogue, unit, rest] = await Promise.all([
    source.listSets(session.id),
    source.listExercises({ includeArchived: true }),
    source.readUnit(),
    source.readRest(),
  ])
  const history = await source.setsForExercises(exerciseOrder(sets, []))

  return {
    session,
    sets,
    history,
    exercises: new Map(catalogue.map((exercise) => [exercise.id, exercise])),
    unit,
    rest,
  }
}

export type LiveSessionProps = {
  source?: LiveSessionSource
  pickerSource?: ExerciseSource
  now?: () => Date
  onFinished?: () => void
  alert?: RestAlert
}

export function goToWorkouts(): void {
  window.location.assign(WORKOUTS_PATH)
}

export function LiveSession({
  source = REPOSITORY_LIVE_SOURCE,
  pickerSource,
  now = systemNow,
  onFinished = goToWorkouts,
  alert,
}: LiveSessionProps) {
  const [read, setRead] = useState<ReadState>({ status: 'loading' })
  const [chosen, setChosen] = useState<string | null>(null)
  const [extra, setExtra] = useState<string[]>([])
  const [picked, setPicked] = useState<Map<string, Exercise>>(new Map())
  const [previous, setPrevious] = useState<Map<string, WorkoutSet | null>>(new Map())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingSet | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [toast, setToast] = useState<(Toast & { setId: string }) | null>(null)
  const [restTweak, setRestTweak] = useState<RestTweak | null>(null)
  const [changingRest, setChangingRest] = useState<ChangingRest | null>(null)
  const [restBusy, setRestBusy] = useState(false)
  const [restError, setRestError] = useState<string | null>(null)
  const alertRef = useRef<RestAlert | null>(alert ?? null)
  const deletes = useRef(0)
  const alive = useRef(true)
  const listHeadingId = useId()

  const refresh = useCallback(async () => {
    try {
      const snapshot = await readSnapshot(source)

      if (alive.current) {
        setRead(snapshot === null ? { status: 'none' } : { status: 'ready', snapshot })
      }
    } catch {
      if (alive.current) {
        setRead({ status: 'failed' })
      }
    }
  }, [source])

  useEffect(() => {
    alive.current = true
    void refresh()

    return () => {
      alive.current = false
    }
  }, [refresh])

  const snapshot = read.status === 'ready' ? read.snapshot : null
  const order = snapshot === null ? [] : exerciseOrder(snapshot.sets, extra)
  const lastSet = snapshot === null ? undefined : lastOf(snapshot.sets)
  const activeId =
    chosen !== null && order.includes(chosen) ? chosen : (lastSet?.exercise_id ?? order.at(-1))
  const activeSets =
    snapshot === null || activeId === undefined
      ? []
      : snapshot.sets.filter((set) => set.exercise_id === activeId)
  const needsPrevious = activeId !== undefined && activeSets.length === 0 && !previous.has(activeId)

  useEffect(() => {
    if (!needsPrevious) {
      return
    }

    let live = true

    source.lastSetFor(activeId).then(
      (set) => {
        if (live) {
          setPrevious((held) => new Map(held).set(activeId, set ?? null))
        }
      },
      () => {
        if (live) {
          setPrevious((held) => new Map(held).set(activeId, null))
        }
      },
    )

    return () => {
      live = false
    }
  }, [needsPrevious, activeId, source])

  if (read.status === 'loading') {
    return (
      <p role="status" className="text-muted text-sm">
        Reading this device…
      </p>
    )
  }

  if (read.status === 'failed') {
    return (
      <p role="alert" className="text-danger text-sm">
        {READ_FAILED}
      </p>
    )
  }

  if (snapshot === null) {
    return (
      <>
        <h1 className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]">Session</h1>
        <p className="text-muted mt-3 text-sm">No session is running on this device.</p>
        <Link
          href={WORKOUTS_PATH}
          className="bg-accent text-accent-ink border-accent rounded-input mt-4 inline-flex min-h-[54px] w-full items-center justify-center gap-2 border px-4 text-[15px] font-bold tracking-[-0.2px]"
        >
          Go to Workouts
        </Link>
      </>
    )
  }

  const { session, sets, history, unit } = snapshot
  const nameOf = (id: string) => snapshot.exercises.get(id) ?? picked.get(id)
  const records = recordIds(sets, history)
  const active = activeId === undefined ? undefined : nameOf(activeId)
  const copySource =
    lastOf(activeSets) ?? (activeId === undefined ? undefined : previous.get(activeId)) ?? undefined
  const sourceKey = activeId ?? ''
  const others = order.filter((id) => id !== activeId)
  const lastTime =
    activeId === undefined
      ? undefined
      : (lastTimeSet(history, session.id, activeId) ?? previous.get(activeId) ?? undefined)
  const setsOf = (id: string) => sets.filter((set) => set.exercise_id === id)
  const restAlert = () => {
    alertRef.current ??= createRestAlert()
    return alertRef.current
  }
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
  const restName =
    restSet === undefined ? '' : (nameOf(restSet.exercise_id)?.name ?? 'Unknown exercise')
  const changeTweak = (change: (held: RestTweak) => RestTweak) => {
    if (tweak !== null) {
      setRestTweak(change(tweak))
    }
  }

  const saveSet = (values: SetValues) => {
    if (activeId === undefined || busy) {
      return
    }

    restAlert().unlock()
    setBusy(true)
    setError(null)
    source
      .addSet({
        session_id: session.id,
        exercise_id: activeId,
        reps: values.reps,
        weight_kg: values.weight_kg,
        completed_at: now().toISOString(),
      })
      .then(
        async () => {
          setChosen(activeId)
          await refresh()
        },
        (cause: unknown) => {
          setError(failure(cause, SAVE_FAILED))
        },
      )
      .finally(() => {
        setBusy(false)
      })
  }

  const finish = () => {
    if (busy) {
      return
    }

    setBusy(true)
    setError(null)
    source.finishSession(session.id).then(
      () => {
        onFinished()
      },
      (cause: unknown) => {
        setBusy(false)
        setError(failure(cause, FINISH_FAILED))
      },
    )
  }

  const saveEdit = (values: SetValues) => {
    if (editing === null || busy) {
      return
    }

    setBusy(true)
    setEditError(null)
    source
      .updateSet(editing.set.id, { reps: values.reps, weight_kg: values.weight_kg })
      .then(
        async () => {
          setEditing(null)
          await refresh()
        },
        (cause: unknown) => {
          setEditError(failure(cause, EDIT_FAILED))
        },
      )
      .finally(() => {
        setBusy(false)
      })
  }

  const removeSet = (set: WorkoutSet, position: number) => {
    if (busy) {
      return
    }

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
            message: `Set ${String(position)} deleted.`,
            setId: set.id,
          })
          await refresh()
        },
        (cause: unknown) => {
          const message = failure(cause, DELETE_FAILED)

          if (fromSheet) {
            setEditError(message)
          } else {
            setError(message)
          }
        },
      )
      .finally(() => {
        setBusy(false)
      })
  }

  const undo = () => {
    if (toast === null) {
      return
    }

    const { setId } = toast

    setToast(null)
    setError(null)
    source.restoreSet(setId).then(
      async () => {
        await refresh()
      },
      (cause: unknown) => {
        setError(failure(cause, UNDO_FAILED))
      },
    )
  }

  const saveRest = (seconds: number) => {
    if (changingRest === null || restBusy) {
      return
    }

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
          await refresh()
        },
        (cause: unknown) => {
          setRestError(failure(cause, REST_SAVE_FAILED))
        },
      )
      .finally(() => {
        setRestBusy(false)
      })
  }

  const pick = (exercise: Exercise) => {
    setPicked((held) => new Map(held).set(exercise.id, exercise))
    setExtra((held) => (held.includes(exercise.id) ? held : [...held, exercise.id]))
    setChosen(exercise.id)
  }

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]">
            Session
          </h1>
          <p className="text-muted mt-1 text-[13px]">{`Started ${startedText(session.started_at)}`}</p>
        </div>
        <SyncChip className="shrink-0" />
      </header>

      <div
        data-testid="live-grid"
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:grid-rows-[auto_auto_auto_auto_1fr] lg:items-start"
      >
        <HeroCard label="Elapsed" aria-label="Session" className="md:col-span-2 lg:col-1">
          <SessionTimer
            startedAt={session.started_at}
            now={now}
            aria-label="Elapsed time"
            className="mt-2.5 mb-1.5 text-[48px] leading-none font-extrabold tracking-[-2.4px]"
          />
          <p className="text-[13px] font-semibold opacity-80" data-testid="session-summary">
            {heroFooter(sets, unit)}
          </p>
        </HeroCard>

        <div data-testid="live-active" className="flex flex-col gap-3 lg:col-2 lg:row-[1/6]">
          {activeId !== undefined && active !== undefined ? (
            <ExerciseCard
              exercise={active}
              sets={activeSets}
              records={records}
              unit={unit}
              source={copySource}
              sourceKey={sourceKey}
              lastTime={lastTime === undefined ? undefined : lastTimeText(lastTime, unit)}
              readingSource={needsPrevious}
              busy={busy}
              onAddSet={saveSet}
              onEditSet={(set, position) => {
                setEditError(null)
                setEditing({ set, position, exerciseName: active.name })
              }}
              onDeleteSet={removeSet}
            />
          ) : (
            <Card>
              <p className="text-muted text-sm">Add an exercise to log your first set.</p>
            </Card>
          )}
          {restSet === undefined || restCompletedAt === null || tweak?.skipped === true ? null : (
            <RestTimerCard
              key={restSet.id}
              exerciseName={restName}
              completedAt={restCompletedAt}
              restSeconds={restBase}
              savedSeconds={savedRest}
              extraTaps={tweak?.taps ?? 0}
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
        </div>

        {others.length > 0 ? (
          <Card className="lg:hidden" data-testid="done-so-far">
            <MicroLabel as="p">Done so far</MicroLabel>
            <ul className="mt-1.5">
              {others.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(id)
                    }}
                    className="border-border flex min-h-11 w-full items-center justify-between gap-3 border-b py-2 text-left last:border-b-0"
                  >
                    <span className="text-muted min-w-0 text-sm break-words">
                      {nameOf(id)?.name ?? 'Unknown exercise'}
                    </span>
                    <strong className="text-text shrink-0 text-sm">
                      {exerciseSummary(setsOf(id), unit)}
                    </strong>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {order.length > 0 ? (
          <section
            aria-labelledby={listHeadingId}
            data-testid="exercise-list"
            className="hidden flex-col gap-3 lg:col-1 lg:flex"
          >
            <h2 id={listHeadingId} className="px-0.5 pt-1.5">
              <MicroLabel>Exercises</MicroLabel>
            </h2>
            <ul className="flex flex-col gap-2">
              {order.map((id) => {
                const exercise = nameOf(id)
                const current = id === activeId

                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={current ? 'true' : undefined}
                      onClick={() => {
                        setChosen(id)
                      }}
                      className={cn(
                        'bg-surface rounded-card flex min-h-11 w-full flex-col gap-1 border p-4 text-left',
                        current ? 'border-accent' : 'border-border',
                      )}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <strong className="text-text min-w-0 text-[15px] break-words">
                          {exercise?.name ?? 'Unknown exercise'}
                        </strong>
                        {exercise === undefined ? null : (
                          <MicroLabel>{MUSCLE_GROUP_LABEL[exercise.muscle_group]}</MicroLabel>
                        )}
                      </span>
                      <span className="text-muted text-sm">
                        {exerciseSummary(setsOf(id), unit)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {error === null ? null : (
          <p role="alert" className="text-danger text-sm md:col-span-2 lg:col-1">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 md:col-span-2 md:flex-row lg:col-1 lg:flex-col">
          <SecondaryButton
            onClick={() => {
              setPickerOpen(true)
            }}
          >
            Add exercise
          </SecondaryButton>
          <PrimaryButton disabled={busy} onClick={finish}>
            Finish session
          </PrimaryButton>
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false)
        }}
        onPick={pick}
        unitSystem={unit}
        now={now}
        {...(pickerSource === undefined ? {} : { source: pickerSource })}
      />

      <ToastRoom shown={toast !== null} />

      <EditSetSheet
        editing={editing}
        unit={unit}
        busy={busy}
        error={editError}
        onSave={saveEdit}
        onDelete={() => {
          if (editing !== null) {
            removeSet(editing.set, editing.position)
          }
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

      <UndoToast
        toast={toast}
        onUndo={undo}
        onDismiss={() => {
          setToast(null)
        }}
      />
    </>
  )
}
