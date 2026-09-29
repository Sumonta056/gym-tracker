'use client'

import { useId, useState } from 'react'

import { fromDisplayWeight, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { workoutSetSchema } from '../../lib/schema/workoutSet'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { NumberField } from '../ui/NumberField'
import { SecondaryButton } from '../ui/SecondaryButton'

import { MUSCLE_GROUP_LABEL } from './MuscleGroupChips'
import { SetRow } from './SetRow'

import type { Exercise, WorkoutSet } from '../../lib/db/dexie'
import type { UnitSystem } from '../../lib/schema/profile'

export type SetValues = { reps: number; weight_kg: number | null }

export type DraftText = { reps: string; load: string }

export type DraftResult =
  { ok: true; values: SetValues } | { ok: false; errors: { reps?: string; load?: string } }

type CopySource = Pick<WorkoutSet, 'reps' | 'weight_kg'>

export function draftFrom(source: CopySource | undefined, unit: UnitSystem): DraftText {
  if (source === undefined) {
    return { reps: '', load: '' }
  }

  const load =
    source.weight_kg === null
      ? ''
      : String(Math.round(toDisplayWeight(source.weight_kg, unit) * 100) / 100)

  return { reps: String(source.reps), load }
}

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? undefined : result.error?.issues[0]?.message
}

function loadInKg(loadText: string, unit: UnitSystem, source: CopySource | undefined) {
  if (loadText === '') {
    return null
  }

  if (source !== undefined && loadText === draftFrom(source, unit).load) {
    return source.weight_kg
  }

  const shown = Number(loadText)

  return Number.isFinite(shown) ? fromDisplayWeight(shown, unit) : Number.NaN
}

export function readDraft(
  draft: DraftText,
  unit: UnitSystem,
  source: CopySource | undefined,
): DraftResult {
  const repsText = draft.reps.trim()
  const reps = workoutSetSchema.shape.reps.safeParse(repsText === '' ? 0 : Number(repsText))
  const load = workoutSetSchema.shape.weight_kg.safeParse(
    loadInKg(draft.load.trim().replace(',', '.'), unit, source),
  )

  if (reps.success && load.success) {
    return { ok: true, values: { reps: reps.data, weight_kg: load.data } }
  }

  return { ok: false, errors: { reps: firstError(reps), load: firstError(load) } }
}

export type ExerciseCardProps = {
  exercise: Pick<Exercise, 'name' | 'muscle_group'>
  sets: readonly WorkoutSet[]
  records: ReadonlySet<string>
  unit: UnitSystem
  source: CopySource | undefined
  sourceKey: string
  readingSource?: boolean
  busy?: boolean
  onAddSet: (values: SetValues) => void
}

export const READING_LAST_SET = 'Reading the last set…'

export function ExerciseCard({
  exercise,
  sets,
  records,
  unit,
  source,
  sourceKey,
  readingSource = false,
  busy = false,
  onAddSet,
}: ExerciseCardProps) {
  const headingId = useId()

  return (
    <Card selected aria-labelledby={headingId} role="region" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-text min-w-0 text-lg font-bold break-words">
          {exercise.name}
        </h2>
        <MicroLabel>{MUSCLE_GROUP_LABEL[exercise.muscle_group]}</MicroLabel>
      </div>
      <hr className="border-border border-t" />
      {sets.length === 0 ? (
        <p className="text-muted text-sm">No sets yet. Enter the reps and the load.</p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label={`${exercise.name} sets`}>
          {sets.map((set, index) => (
            <SetRow
              key={set.id}
              position={index + 1}
              set={set}
              unit={unit}
              isRecord={records.has(set.id)}
            />
          ))}
        </ol>
      )}
      {readingSource ? (
        <p role="status" className="text-muted text-sm">
          {READING_LAST_SET}
        </p>
      ) : (
        <AddSetForm
          key={sourceKey}
          name={exercise.name}
          unit={unit}
          source={source}
          busy={busy}
          onAddSet={onAddSet}
        />
      )}
    </Card>
  )
}

type AddSetFormProps = {
  name: string
  unit: UnitSystem
  source: CopySource | undefined
  busy: boolean
  onAddSet: (values: SetValues) => void
}

function AddSetForm({ name, unit, source, busy, onAddSet }: AddSetFormProps) {
  const [draft, setDraft] = useState(() => draftFrom(source, unit))
  const [errors, setErrors] = useState<{ reps?: string; load?: string }>({})

  const submit = () => {
    const result = readDraft(draft, unit, source)

    if (!result.ok) {
      setErrors(result.errors)
      return
    }

    setErrors({})
    onAddSet(result.values)
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Reps"
          inputMode="numeric"
          autoComplete="off"
          value={draft.reps}
          error={errors.reps}
          onChange={(event) => {
            setDraft({ ...draft, reps: event.target.value })
          }}
        />
        <NumberField
          label="Load"
          unit={weightSymbol(unit)}
          autoComplete="off"
          placeholder="None"
          value={draft.load}
          error={errors.load}
          onChange={(event) => {
            setDraft({ ...draft, load: event.target.value })
          }}
        />
      </div>
      <SecondaryButton type="submit" disabled={busy}>
        Add set <span className="sr-only">to {name}</span>
      </SecondaryButton>
    </form>
  )
}
