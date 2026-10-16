import { profileSchema } from '../../lib/schema/profile'

import type { Profile } from '../../lib/db/dexie'
import type { MaxHeartRate } from '../../lib/metrics/heartRateZones'

export type HeartRateField = 'birth_year' | 'max_heart_rate'

export const HEART_RATE_FIELDS: readonly HeartRateField[] = ['birth_year', 'max_heart_rate']

export const HEART_RATE_LABELS: Record<HeartRateField, string> = {
  birth_year: 'Birth year',
  max_heart_rate: 'Max heart rate (bpm)',
}

export const MAX_HINT = 'Leave empty to use 220 minus your age.'

export type HeartRateParse = { ok: true; patch: Partial<Profile> } | { ok: false; message: string }

export function heartRateText(profile: Profile, field: HeartRateField): string {
  const value = profile[field] ?? null

  return value === null ? '' : String(value)
}

export function parseHeartRate(field: HeartRateField, text: string): HeartRateParse {
  const trimmed = text.trim()
  const result = profileSchema.shape[field].safeParse(trimmed === '' ? null : Number(trimmed))

  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? 'Check this value.' }
  }

  return { ok: true, patch: { [field]: result.data } }
}

export function maxSourceText(maxHeartRate: MaxHeartRate | null): string {
  if (maxHeartRate === null) {
    return 'Add your birth year to see your max.'
  }

  const from = maxHeartRate.source === 'age' ? 'from your age' : 'your own value'

  return `The zones use ${String(maxHeartRate.bpm)} bpm, ${from}.`
}
