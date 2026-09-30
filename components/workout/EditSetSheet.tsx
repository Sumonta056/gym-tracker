'use client'

import { useState } from 'react'

import { weightSymbol } from '../../lib/format/weight'
import { NumberField } from '../ui/NumberField'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SheetModal } from '../ui/SheetModal'

import { draftFrom, readDraft } from './ExerciseCard'

import type { SetValues } from './ExerciseCard'
import type { WorkoutSet } from '../../lib/db/dexie'
import type { UnitSystem } from '../../lib/schema/profile'

export type EditingSet = {
  set: WorkoutSet
  position: number
  exerciseName: string
}

export type EditSetSheetProps = {
  editing: EditingSet | null
  unit: UnitSystem
  busy?: boolean
  error?: string | null
  onSave: (values: SetValues) => void
  onDelete: () => void
  onClose: () => void
}

export function editTitle(position: number): string {
  return `Edit set ${String(position)}`
}

export function EditSetSheet({
  editing,
  unit,
  busy = false,
  error = null,
  onSave,
  onDelete,
  onClose,
}: EditSetSheetProps) {
  return (
    <SheetModal
      open={editing !== null}
      title={editing === null ? '' : editTitle(editing.position)}
      onClose={onClose}
    >
      {editing === null ? null : (
        <EditSetForm
          key={editing.set.id}
          editing={editing}
          unit={unit}
          busy={busy}
          error={error}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </SheetModal>
  )
}

type EditSetFormProps = {
  editing: EditingSet
  unit: UnitSystem
  busy: boolean
  error: string | null
  onSave: (values: SetValues) => void
  onDelete: () => void
}

function EditSetForm({ editing, unit, busy, error, onSave, onDelete }: EditSetFormProps) {
  const { set, exerciseName } = editing
  const [draft, setDraft] = useState(() => draftFrom(set, unit))
  const [errors, setErrors] = useState<{ reps?: string; load?: string }>({})

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const result = readDraft(draft, unit, set)

        if (!result.ok) {
          setErrors(result.errors)
          return
        }

        setErrors({})
        onSave(result.values)
      }}
    >
      <p className="text-muted text-sm">{exerciseName}</p>
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
      {error === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <PrimaryButton type="submit" disabled={busy}>
        Save set
      </PrimaryButton>
      <SecondaryButton tone="danger" disabled={busy} onClick={onDelete}>
        Delete set
      </SecondaryButton>
    </form>
  )
}
