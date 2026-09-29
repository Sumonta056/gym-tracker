'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  addSet,
  finishSession,
  getActiveSession,
  getProfile,
  lastSetFor,
  listExercises,
  listSets,
  setsForExercises,
  SignedOutOnThisDevice,
} from '../../lib/db/repository'
import { toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { isNewRecord } from '../../lib/metrics/personalRecords'
import { volumeLoad } from '../../lib/metrics/volumeLoad'
import { formatCount } from '../dashboard/summary'
import { SyncChip } from '../sync/SyncChip'
import { Card } from '../ui/Card'
import { HeroCard } from '../ui/HeroCard'
import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'

import { ExerciseCard } from './ExerciseCard'
import { ExercisePicker } from './ExercisePicker'
import { SessionTimer, systemNow } from './SessionTimer'

import type { SetValues } from './ExerciseCard'
import type { ExerciseSource } from './ExercisePicker'
import type { Exercise, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
import type { ExerciseFilter } from '../../lib/db/repository'
import type { UnitSystem } from '../../lib/schema/profile'

export type LiveSessionSource = {
  getActiveSession: () => Promise<WorkoutSession | undefined>
  listSets: (sessionId: string) => Promise<WorkoutSet[]>
  listExercises: (filter: ExerciseFilter) => Promise<Exercise[]>
  setsForExercises: (exerciseIds: string[]) => Promise<WorkoutSet[]>
  lastSetFor: (exerciseId: string) => Promise<WorkoutSet | undefined>
  addSet: typeof addSet
  finishSession: (id: string) => Promise<WorkoutSession>
  readUnit: () => Promise<UnitSystem>
}

export const REPOSITORY_LIVE_SOURCE: LiveSessionSource = {
  getActiveSession,
  listSets,
  listExercises,
  setsForExercises,
  lastSetFor,
  addSet,
  finishSession,
  readUnit: async () => (await getProfile()).unit_system,
}

export const READ_FAILED = 'The session could not be read on this device.'

export const SAVE_FAILED = 'The set could not be saved on this device.'

export const FINISH_FAILED = 'The session could not be finished on this device.'

export const WORKOUTS_PATH = '/workouts'

type Snapshot = {
  session: WorkoutSession
  sets: WorkoutSet[]
  history: WorkoutSet[]
  exercises: Map<string, Exercise>
  unit: UnitSystem
}

type ReadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'none' }
  | { status: 'ready'; snapshot: Snapshot }

function doneAt(set: WorkoutSet): number {
  return Date.parse(set.completed_at ?? set.created_at)
}

export function earlierThan(left: WorkoutSet, right: WorkoutSet): boolean {
  return (
    (doneAt(left) - doneAt(right) ||
      Date.parse(left.created_at) - Date.parse(right.created_at) ||
      left.set_index - right.set_index ||
      left.id.localeCompare(right.id)) < 0
  )
}

export function recordIds(
  sets: readonly WorkoutSet[],
  history: readonly WorkoutSet[],
): Set<string> {
  return new Set(
    sets
      .filter((set) =>
        isNewRecord(
          set,
          history.filter((item) => earlierThan(item, set)),
        ),
      )
      .map((set) => set.id),
  )
}

export function exerciseOrder(sets: readonly WorkoutSet[], extra: readonly string[]): string[] {
  return [...new Set([...sets.map((set) => set.exercise_id), ...extra])]
}

export function lastOf(sets: readonly WorkoutSet[]): WorkoutSet | undefined {
  return [...sets].sort((left, right) => (earlierThan(left, right) ? -1 : 1)).at(-1)
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

export function startedText(startedAt: string): string {
  return new Date(startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

async function readSnapshot(source: LiveSessionSource): Promise<Snapshot | null> {
  const session = await source.getActiveSession()

  if (session === undefined) {
    return null
  }

  const [sets, catalogue, unit] = await Promise.all([
    source.listSets(session.id),
    source.listExercises({ includeArchived: true }),
    source.readUnit(),
  ])
  const history = await source.setsForExercises(exerciseOrder(sets, []))

  return {
    session,
    sets,
    history,
    exercises: new Map(catalogue.map((exercise) => [exercise.id, exercise])),
    unit,
  }
}

export type LiveSessionProps = {
  source?: LiveSessionSource
  pickerSource?: ExerciseSource
  now?: () => Date
  onFinished?: () => void
}

export function goToWorkouts(): void {
  window.location.assign(WORKOUTS_PATH)
}

export function LiveSession({
  source = REPOSITORY_LIVE_SOURCE,
  pickerSource,
  now = systemNow,
  onFinished = goToWorkouts,
}: LiveSessionProps) {
  const [read, setRead] = useState<ReadState>({ status: 'loading' })
  const [chosen, setChosen] = useState<string | null>(null)
  const [extra, setExtra] = useState<string[]>([])
  const [picked, setPicked] = useState<Map<string, Exercise>>(new Map())
  const [previous, setPrevious] = useState<Map<string, WorkoutSet | null>>(new Map())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

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

  const saveSet = (values: SetValues) => {
    if (activeId === undefined || busy) {
      return
    }

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
          setError(cause instanceof SignedOutOnThisDevice ? cause.message : SAVE_FAILED)
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
        setError(cause instanceof SignedOutOnThisDevice ? cause.message : FINISH_FAILED)
      },
    )
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

      <div data-testid="live-grid" className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <HeroCard label="Elapsed" aria-label="Session" className="md:col-span-2">
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

        {activeId !== undefined && active !== undefined ? (
          <ExerciseCard
            exercise={active}
            sets={activeSets}
            records={records}
            unit={unit}
            source={copySource}
            sourceKey={sourceKey}
            readingSource={needsPrevious}
            busy={busy}
            onAddSet={saveSet}
          />
        ) : (
          <Card>
            <p className="text-muted text-sm">Add an exercise to log your first set.</p>
          </Card>
        )}

        {others.length > 0 ? (
          <Card>
            <MicroLabel as="p">Done so far</MicroLabel>
            <ul className="mt-1.5">
              {others.map((id) => {
                const exerciseSets = sets.filter((set) => set.exercise_id === id)

                return (
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
                        {exerciseSets.length === 0
                          ? 'No sets'
                          : `${plural(exerciseSets.length, 'set')} · ${volumeText(exerciseSets, unit)}`}
                      </strong>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        ) : null}

        {error === null ? null : (
          <p role="alert" className="text-danger text-sm md:col-span-2">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 md:col-span-2 md:flex-row">
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
    </>
  )
}
