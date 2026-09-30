'use client'

import { useState } from 'react'

import { formatDuration, parseInput } from '../../lib/duration'
import { profileSchema } from '../../lib/schema/profile'
import { Field } from '../ui/Field'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SheetModal } from '../ui/SheetModal'

export const REST_HINT = 'Accepts 1:30, 90s or 2m.'

export const restSecondsSchema = profileSchema.shape.rest_seconds_by_exercise.unwrap().valueType

export type RestReading = { ok: true; seconds: number } | { ok: false; reason: string }

export function readRestText(text: string): RestReading {
  const parsed = parseInput(text)

  if (!parsed.ok) {
    return parsed
  }

  const checked = restSecondsSchema.safeParse(parsed.seconds)

  return checked.success
    ? { ok: true, seconds: checked.data }
    : { ok: false, reason: checked.error.issues[0]?.message ?? 'Enter a rest time.' }
}

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
  return (
    <SheetModal
      open={changing !== null}
      title={changing === null ? '' : restSheetTitle(changing.exerciseName)}
      onClose={onClose}
    >
      {changing === null ? null : (
        <RestTimeForm
          key={changing.exerciseId}
          changing={changing}
          busy={busy}
          error={error}
          onSave={onSave}
        />
      )}
    </SheetModal>
  )
}

type RestTimeFormProps = {
  changing: ChangingRest
  busy: boolean
  error: string | null
  onSave: (seconds: number) => void
}

function RestTimeForm({ changing, busy, error, onSave }: RestTimeFormProps) {
  const [text, setText] = useState(() => formatDuration(changing.seconds, 'clock'))
  const [reason, setReason] = useState<string | undefined>(undefined)

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const reading = readRestText(text)

        if (!reading.ok) {
          setReason(reading.reason)
          return
        }

        setReason(undefined)
        onSave(reading.seconds)
      }}
    >
      <p className="text-muted text-sm">The next rest after this exercise uses the new time.</p>
      <Field
        label="Rest time"
        type="text"
        inputMode="text"
        autoComplete="off"
        hint={REST_HINT}
        placeholder="1:30"
        value={text}
        error={reason}
        onChange={(event) => {
          setText(event.target.value)
        }}
      />
      {error === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <PrimaryButton type="submit" disabled={busy}>
        Save rest time
      </PrimaryButton>
    </form>
  )
}
