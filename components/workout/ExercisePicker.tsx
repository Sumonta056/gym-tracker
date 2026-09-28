'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { createExercise, lastSetsFor, listExercises } from '../../lib/db/repository'
import { toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { FIELD_INPUT_CLASS } from '../ui/Field'
import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SheetModal } from '../ui/SheetModal'

import { CreateExerciseActions, CreateExerciseForm } from './CreateExerciseForm'
import { MUSCLE_GROUP_LABEL, MuscleGroupChips } from './MuscleGroupChips'

import type { Exercise, WorkoutSet } from '../../lib/db/dexie'
import type { ExerciseFilter } from '../../lib/db/repository'
import type { ExerciseInput, MuscleGroup } from '../../lib/schema/exercise'
import type { UnitSystem } from '../../lib/schema/profile'

export type ExerciseSource = {
  listExercises: (filter: ExerciseFilter) => Promise<Exercise[]>
  lastSetsFor: (exerciseIds: string[]) => Promise<Map<string, WorkoutSet>>
  createExercise: (input: ExerciseInput) => Promise<Exercise>
}

export const REPOSITORY_SOURCE: ExerciseSource = { listExercises, lastSetsFor, createExercise }

export const RECENT_LIMIT = 5

export const PICK_TITLE = 'Pick an exercise'

export const CREATE_TITLE = 'New exercise'

export const READ_FAILED = 'The exercises could not be read on this device.'

const DAY_MS = 86_400_000

export type ExercisePickerProps = {
  open: boolean
  onClose: () => void
  onPick: (exercise: Exercise) => void
  unitSystem?: UnitSystem
  now?: () => Date
  source?: ExerciseSource
}

type RecentExercise = { exercise: Exercise; set: WorkoutSet }

type Listing = {
  key: string
  exercises: Exercise[]
  recent: RecentExercise[]
  failed: boolean
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function setTime(set: WorkoutSet): string {
  return set.completed_at ?? set.created_at
}

export function daysBetween(then: Date, now: Date): number {
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS))
}

export function agoShort(days: number): string {
  return days === 0 ? 'Today' : `${String(days)}d`
}

export function agoSpoken(days: number): string {
  if (days === 0) {
    return 'today'
  }

  return days === 1 ? '1 day ago' : `${String(days)} days ago`
}

export function formatLoad(set: WorkoutSet, unit: UnitSystem): string {
  if (set.weight_kg === null) {
    return `${String(set.reps)} reps`
  }

  const load = Math.round(toDisplayWeight(set.weight_kg, unit) * 100) / 100

  return `${String(load)} ${weightSymbol(unit)} × ${String(set.reps)}`
}

function listingKey(query: string, muscleGroup: MuscleGroup | null): string {
  return `${muscleGroup ?? ''}|${query}`
}

async function readListing(
  source: ExerciseSource,
  query: string,
  muscleGroup: MuscleGroup | null,
): Promise<Omit<Listing, 'key' | 'failed'>> {
  const exercises = await source.listExercises({
    query,
    ...(muscleGroup === null ? {} : { muscleGroup }),
  })

  if (query !== '') {
    return { exercises, recent: [] }
  }

  const sets = await source.lastSetsFor(exercises.map((exercise) => exercise.id))
  const recent = exercises
    .flatMap((exercise) => {
      const set = sets.get(exercise.id)
      return set === undefined ? [] : [{ exercise, set }]
    })
    .sort((left, right) => setTime(right.set).localeCompare(setTime(left.set)))
    .slice(0, RECENT_LIMIT)

  return { exercises, recent }
}

function emptyMessage(current: Listing | null, query: string): string {
  if (current === null || current.failed || current.exercises.length > 0) {
    return ''
  }

  return query === '' ? 'No exercises on this device yet.' : `No exercise matches “${query}”.`
}

type PickRowProps = {
  exercise: Exercise
  detail: string
  ago?: { short: string; spoken: string }
  onPick: (exercise: Exercise) => void
}

function PickRow({ exercise, detail, ago, onPick }: PickRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onPick(exercise)
        }}
        className="border-border flex min-h-[52px] w-full items-center justify-between gap-3 border-b px-1 py-2 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-text text-[15px] font-bold break-words">{exercise.name}</span>
          <span className="text-muted text-xs">{detail}</span>
        </span>
        {ago === undefined ? null : (
          <span className="text-muted shrink-0 text-xs">
            <span aria-hidden="true">{ago.short}</span>
            <span className="sr-only">{`, ${ago.spoken}`}</span>
          </span>
        )}
      </button>
    </li>
  )
}

export function ExercisePicker({ open, ...rest }: ExercisePickerProps) {
  return open ? <PickerSheet {...rest} /> : null
}

function PickerSheet({
  onClose,
  onPick,
  unitSystem = 'metric',
  now = () => new Date(),
  source = REPOSITORY_SOURCE,
}: Omit<ExercisePickerProps, 'open'>) {
  const searchId = useId()
  const recentId = useId()
  const allId = useId()
  const createId = useId()
  const formId = useId()
  const returning = useRef(false)
  const [view, setView] = useState<'pick' | 'create'>('pick')
  const [query, setQuery] = useState('')
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null)
  const [listing, setListing] = useState<Listing | null>(null)
  const trimmed = query.trim()
  const key = listingKey(trimmed, muscleGroup)

  useEffect(() => {
    let live = true

    readListing(source, trimmed, muscleGroup).then(
      (read) => {
        if (live) {
          setListing({ key, failed: false, ...read })
        }
      },
      () => {
        if (live) {
          setListing({ key, failed: true, exercises: [], recent: [] })
        }
      },
    )

    return () => {
      live = false
    }
  }, [source, trimmed, muscleGroup, key])

  useEffect(() => {
    if (view === 'pick' && returning.current) {
      returning.current = false
      document.getElementById(createId)?.focus()
    }
  }, [view, createId])

  const pick = (exercise: Exercise) => {
    onPick(exercise)
    onClose()
  }

  const current = listing?.key === key ? listing : null
  const today = now()

  const backToList = () => {
    returning.current = true
    setView('pick')
  }

  if (view === 'create') {
    return (
      <SheetModal
        open
        title={CREATE_TITLE}
        onClose={onClose}
        footer={<CreateExerciseActions formId={formId} onCancel={backToList} />}
      >
        <CreateExerciseForm
          id={formId}
          initialName={trimmed}
          initialMuscleGroup={muscleGroup ?? undefined}
          onCreate={source.createExercise}
          onCreated={pick}
        />
      </SheetModal>
    )
  }

  return (
    <SheetModal
      open
      title={PICK_TITLE}
      onClose={onClose}
      footer={
        <SecondaryButton
          id={createId}
          onClick={() => {
            setView('create')
          }}
        >
          Create a new exercise
        </SecondaryButton>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor={searchId} className="sr-only">
            Search exercises
          </label>
          <input
            id={searchId}
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Search exercises"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            className={`${FIELD_INPUT_CLASS} border-border`}
          />
        </div>

        <MuscleGroupChips
          includeAll
          label="Muscle group"
          value={muscleGroup}
          onValueChange={setMuscleGroup}
        />

        {current?.failed === true ? (
          <p role="alert" className="text-danger text-sm">
            {READ_FAILED}
          </p>
        ) : null}

        {current !== null && current.recent.length > 0 ? (
          <section aria-labelledby={recentId} className="flex flex-col gap-1">
            <MicroLabel as="p" id={recentId}>
              Recent
            </MicroLabel>
            <ul>
              {current.recent.map(({ exercise, set }) => {
                const days = daysBetween(new Date(setTime(set)), today)

                return (
                  <PickRow
                    key={exercise.id}
                    exercise={exercise}
                    detail={`${MUSCLE_GROUP_LABEL[exercise.muscle_group]} · ${formatLoad(set, unitSystem)}`}
                    ago={{ short: agoShort(days), spoken: agoSpoken(days) }}
                    onPick={pick}
                  />
                )
              })}
            </ul>
          </section>
        ) : null}

        {current !== null && current.exercises.length > 0 ? (
          <section aria-labelledby={allId} className="flex flex-col gap-1">
            <MicroLabel as="p" id={allId}>
              {trimmed === '' ? 'All exercises' : 'Matches'}
            </MicroLabel>
            <ul>
              {current.exercises.map((exercise) => (
                <PickRow
                  key={exercise.id}
                  exercise={exercise}
                  detail={MUSCLE_GROUP_LABEL[exercise.muscle_group]}
                  onPick={pick}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <p role="status" className="text-muted text-sm">
          {emptyMessage(current, trimmed)}
        </p>
      </div>
    </SheetModal>
  )
}
