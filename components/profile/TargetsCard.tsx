'use client'

import { useState } from 'react'

import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { NumberField } from '../ui/NumberField'

import { parseTarget, TARGET_FIELDS, targetLabel, targetText } from './targets'

import type { TargetField } from './targets'
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

type Errors = Partial<Record<TargetField, string>>

export function TargetsCard({ profile, unit, onSave, className }: TargetsCardProps) {
  const [drafts, setDrafts] = useState<Drafts>({})
  const [errors, setErrors] = useState<Errors>({})
  const [saved, setSaved] = useState(false)

  function settle(field: TargetField, error: string | undefined): void {
    setErrors((current) => ({ ...current, [field]: error }))

    if (error === undefined) {
      setDrafts((current) => ({ ...current, [field]: undefined }))
    }
  }

  async function commit(field: TargetField): Promise<void> {
    const draft = drafts[field]

    if (draft === undefined || draft === targetText(profile, field, unit)) {
      settle(field, undefined)
      return
    }

    const parsed = parseTarget(field, draft, unit)

    if (!parsed.ok) {
      setSaved(false)
      settle(field, parsed.message)
      return
    }

    try {
      await onSave(parsed.patch)
      setSaved(true)
      settle(field, undefined)
    } catch {
      setSaved(false)
      settle(field, SAVE_FAILED)
    }
  }

  return (
    <Card className={className}>
      <MicroLabel as="p">Targets</MicroLabel>
      <div className="mt-2.5 grid gap-2.5">
        {TARGET_FIELDS.map((field) => (
          <NumberField
            key={field}
            label={targetLabel(field, unit)}
            inputMode={field === 'target_weight_kg' ? 'decimal' : 'numeric'}
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
      </div>
      <p role="status" className="text-muted mt-2.5 min-h-4 text-xs">
        {saved ? SAVED : ''}
      </p>
    </Card>
  )
}
