'use client'

import { useId, useState } from 'react'

import { MAX_REST_SECONDS } from '../../lib/schema/profile'
import { DurationPicker, REST_PRESETS } from '../ui/DurationPicker'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SheetModal } from '../ui/SheetModal'

export function restSheetTitle(exerciseName: string): string {
  return `Rest for ${exerciseName}`
}

export type ChangingRest = {
  exerciseId: string
  exerciseName: string
  seconds: number
}

export type RestTimeSheetProps = {
  changing: ChangingRest | null
  busy?: boolean
  error?: string | null
  onSave: (seconds: number) => void
  onClose: () => void
}

export function RestTimeSheet({
  changing,
  busy = false,
  error = null,
  onSave,
  onClose,
}: RestTimeSheetProps) {
  const formId = useId()

  return (
    <SheetModal
      open={changing !== null}
      title={changing === null ? '' : restSheetTitle(changing.exerciseName)}
      onClose={onClose}
      footer={
        changing === null ? undefined : (
          <PrimaryButton type="submit" form={formId} disabled={busy}>
            Save rest time
          </PrimaryButton>
        )
      }
    >
      {changing === null ? null : (
        <RestTimeForm
          key={changing.exerciseId}
          id={formId}
          changing={changing}
          error={error}
          onSave={onSave}
        />
      )}
    </SheetModal>
  )
}

type RestTimeFormProps = {
  id: string
  changing: ChangingRest
  error: string | null
  onSave: (seconds: number) => void
}

function RestTimeForm({ id, changing, error, onSave }: RestTimeFormProps) {
  const [seconds, setSeconds] = useState(changing.seconds)

  return (
    <form
      id={id}
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(seconds)
      }}
    >
      <p className="text-muted text-sm">The next rest after this exercise uses the new time.</p>
      <DurationPicker
        id="rest-seconds"
        label="Rest time"
        value={seconds}
        onChange={(next) => {
          if (next !== null) {
            setSeconds(next)
          }
        }}
        presets={REST_PRESETS}
        max={MAX_REST_SECONDS}
      />
      {error === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </form>
  )
}
