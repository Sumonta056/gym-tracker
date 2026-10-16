'use client'

import { useState } from 'react'

import { Card } from '../ui/Card'
import { DurationPicker } from '../ui/DurationPicker'
import { MicroLabel } from '../ui/MicroLabel'
import { NumberField } from '../ui/NumberField'
import { SAVED_MESSAGE, useToast } from '../ui/Toast'

import {
  DURATION_TARGETS,
  durationLabel,
  GOAL_MAX_SECONDS,
  GOAL_MIN_SECONDS,
  GOAL_PRESETS,
  GOAL_STEP_SECONDS,
  parseDurationTarget,
  parseTarget,
  TARGET_FIELDS,
  targetLabel,
  targetText,
} from './targets'

import type { DurationTarget, TargetField } from './targets'
import type { Profile } from '../../lib/db/dexie'
import type { UnitSystem } from '../../lib/schema/profile'

export const SAVE_FAILED = 'This target could not be saved on this device.'

export const SAVED = 'Saved on this device.'

export type TargetsCardProps = {
  profile: Profile
  unit: UnitSystem
  onSave: (patch: Partial<Profile>) => Promise<void>
  className?: string
}

type Drafts = Partial<Record<TargetField, string>>

type Held = Partial<Record<DurationTarget, number | null>>

type Errors = Partial<Record<TargetField | DurationTarget, string>>

const DECIMAL: ReadonlySet<TargetField> = new Set(['target_weight_kg', 'height_cm'])

export function TargetsCard({ profile, unit, onSave, className }: TargetsCardProps) {
  const [drafts, setDrafts] = useState<Drafts>({})
  const [held, setHeld] = useState<Held>({})
  const [errors, setErrors] = useState<Errors>({})
  const [saved, setSaved] = useState(false)
  const toast = useToast()

  function fail(field: TargetField | DurationTarget, message: string): void {
    setSaved(false)
    setErrors((current) => ({ ...current, [field]: message }))
  }

  function pass(field: TargetField | DurationTarget): void {
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function commit(field: TargetField): Promise<void> {
    const draft = drafts[field]

    if (draft === undefined || draft === targetText(profile, field, unit)) {
      pass(field)
      setDrafts((current) => ({ ...current, [field]: undefined }))
      return
    }

    const parsed = parseTarget(field, draft, unit)

    if (!parsed.ok) {
      fail(field, parsed.message)
      return
    }

    try {
      await onSave(parsed.patch)
      setSaved(true)
      toast.show(SAVED_MESSAGE)
      pass(field)
      setDrafts((current) => ({ ...current, [field]: undefined }))
    } catch {
      fail(field, SAVE_FAILED)
    }
  }

  function changeDuration(field: DurationTarget, seconds: number | null): void {
    const parsed = parseDurationTarget(field, seconds)

    if (!parsed.ok) {
      fail(field, parsed.message)
      return
    }

    setHeld((current) => ({ ...current, [field]: seconds }))
    onSave(parsed.patch).then(
      () => {
        setSaved(true)
        toast.show(SAVED_MESSAGE)
        pass(field)
      },
      () => {
        setHeld((current) => ({ ...current, [field]: undefined }))
        fail(field, SAVE_FAILED)
      },
    )
  }

  return (
    <Card className={className}>
      <MicroLabel as="p">Goals</MicroLabel>
      <div className="mt-2.5 grid gap-2.5">
        {TARGET_FIELDS.map((field) => (
          <NumberField
            key={field}
            label={targetLabel(field, unit)}
            inputMode={DECIMAL.has(field) ? 'decimal' : 'numeric'}
            value={drafts[field] ?? targetText(profile, field, unit)}
            error={errors[field]}
            onChange={(event) => {
              setDrafts((current) => ({ ...current, [field]: event.target.value }))
            }}
            onBlur={() => {
              void commit(field)
            }}
          />
        ))}
        {DURATION_TARGETS.map((field) => {
          const error = errors[field]

          return (
            <div key={field}>
              <DurationPicker
                id={`goal-${field}`}
                label={durationLabel(field)}
                value={held[field] === undefined ? (profile[field] ?? null) : held[field]}
                onChange={(seconds) => {
                  changeDuration(field, seconds)
                }}
                presets={GOAL_PRESETS[field]}
                step={GOAL_STEP_SECONDS}
                min={GOAL_MIN_SECONDS}
                max={GOAL_MAX_SECONDS}
                allowClear
                errorId={error === undefined ? undefined : `goal-${field}-error`}
              />
              {error === undefined ? null : (
                <p id={`goal-${field}-error`} role="alert" className="text-danger mt-[7px] text-xs">
                  {error}
                </p>
              )}
            </div>
          )
        })}
      </div>
      <p role="status" className="text-muted mt-2.5 min-h-4 text-xs">
        {saved ? SAVED : ''}
      </p>
    </Card>
  )
}
