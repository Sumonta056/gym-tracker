'use client'

import { useId, useState } from 'react'

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
  const formId = useId()

  return (
    <SheetModal
      open={editing !== null}
      title={editing === null ? '' : editTitle(editing.position)}
      onClose={onClose}
      footer={
        editing === null ? undefined : (
          <div className="flex flex-col gap-3">
            <PrimaryButton type="submit" form={formId} disabled={busy}>
              Save set
            </PrimaryButton>
            <SecondaryButton tone="danger" disabled={busy} onClick={onDelete}>
              Delete set
            </SecondaryButton>
          </div>
        )
      }
    >
      {editing === null ? null : (
        <EditSetForm
          key={editing.set.id}
          id={formId}
          editing={editing}
          unit={unit}
          error={error}
          onSave={onSave}
        />
      )}
    </SheetModal>
  )
}

type EditSetFormProps = {
  id: string
  editing: EditingSet
  unit: UnitSystem
  error: string | null
  onSave: (values: SetValues) => void
}

function EditSetForm({ id, editing, unit, error, onSave }: EditSetFormProps) {
  const { set, exerciseName } = editing
  const [draft, setDraft] = useState(() => draftFrom(set, unit))
  const [errors, setErrors] = useState<{ reps?: string; load?: string }>({})

  return (
    <form
      id={id}
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
    </form>
  )
}
