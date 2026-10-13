'use client'

import { useState } from 'react'

import { resolveMaxHeartRate } from '../../lib/metrics/heartRateZones'
import { localDate } from '../../lib/schema/dailyEntry'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { NumberField } from '../ui/NumberField'
import { SAVED_MESSAGE, useToast } from '../ui/Toast'

import {
  HEART_RATE_FIELDS,
  HEART_RATE_LABELS,
  heartRateText,
  MAX_HINT,
  maxSourceText,
  parseHeartRate,
} from './heartRate'
import { SAVE_FAILED, SAVED } from './TargetsCard'

import type { HeartRateField } from './heartRate'
import type { Profile } from '../../lib/db/dexie'

export type HeartRateCardProps = {
  profile: Profile
  onSave: (patch: Partial<Profile>) => Promise<void>
  today?: string
  className?: string
}

type Drafts = Partial<Record<HeartRateField, string>>

type Errors = Partial<Record<HeartRateField, string>>

export function HeartRateCard({
  profile,
  onSave,
  today = localDate(new Date()),
  className,
}: HeartRateCardProps) {
  const [drafts, setDrafts] = useState<Drafts>({})
  const [errors, setErrors] = useState<Errors>({})
  const [saved, setSaved] = useState(false)
  const toast = useToast()
  const maxHeartRate = resolveMaxHeartRate(
    { max_heart_rate: profile.max_heart_rate ?? null, birth_year: profile.birth_year ?? null },
    today,
  )

  function fail(field: HeartRateField, message: string): void {
    setSaved(false)
    setErrors((current) => ({ ...current, [field]: message }))
  }

  function settle(field: HeartRateField): void {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setDrafts((current) => ({ ...current, [field]: undefined }))
  }

  async function commit(field: HeartRateField): Promise<void> {
    const draft = drafts[field]

    if (draft === undefined || draft === heartRateText(profile, field)) {
      settle(field)
      return
    }

    const parsed = parseHeartRate(field, draft)

    if (!parsed.ok) {
      fail(field, parsed.message)
      return
    }

    try {
      await onSave(parsed.patch)
      setSaved(true)
      toast.show(SAVED_MESSAGE)
      settle(field)
    } catch {
      fail(field, SAVE_FAILED)
    }
  }

  return (
    <Card className={className}>
      <MicroLabel as="p">Heart rate</MicroLabel>
      <div className="mt-2.5 grid gap-2.5">
        {HEART_RATE_FIELDS.map((field) => (
          <NumberField
            key={field}
            label={HEART_RATE_LABELS[field]}
            inputMode="numeric"
            hint={field === 'max_heart_rate' ? MAX_HINT : undefined}
            value={drafts[field] ?? heartRateText(profile, field)}
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
      <p className="text-muted mt-2.5 text-xs">{maxSourceText(maxHeartRate)}</p>
      <p role="status" className="text-muted mt-2.5 min-h-4 text-xs">
        {saved ? SAVED : ''}
      </p>
    </Card>
  )
}
