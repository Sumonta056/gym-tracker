import { formatWeight, fromDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { profileSchema } from '../../lib/schema/profile'

import type { Profile } from '../../lib/db/dexie'
import type { UnitSystem } from '../../lib/schema/profile'

export type TargetField = 'target_weight_kg' | 'step_goal' | 'height_cm'

export const TARGET_FIELDS: readonly TargetField[] = ['target_weight_kg', 'step_goal', 'height_cm']

export type TargetParse = { ok: true; patch: Partial<Profile> } | { ok: false; message: string }

export function targetLabel(field: TargetField, unit: UnitSystem): string {
  if (field === 'target_weight_kg') {
    return `Target weight (${weightSymbol(unit)})`
  }

  return field === 'step_goal' ? 'Daily step goal' : 'Height (cm)'
}

export function targetText(profile: Profile, field: TargetField, unit: UnitSystem): string {
  if (field === 'target_weight_kg') {
    const kg = profile.target_weight_kg

    return kg === null ? '' : formatWeight(kg, unit, 1)
  }

  const value = profile[field]

  return value === null ? '' : String(value)
}

function readNumber(text: string): number | null {
  const trimmed = text.trim()

  return trimmed === '' ? null : Number(trimmed)
}

function toStored(field: TargetField, value: number | null, unit: UnitSystem): number | null {
  if (field !== 'target_weight_kg' || value === null || !Number.isFinite(value)) {
    return value
  }

  return fromDisplayWeight(value, unit)
}

export function parseTarget(field: TargetField, text: string, unit: UnitSystem): TargetParse {
  const value = toStored(field, readNumber(text), unit)
  const result = profileSchema.shape[field].safeParse(value ?? (field === 'step_goal' ? NaN : null))

  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? 'Check this value.' }
  }

  return { ok: true, patch: { [field]: result.data } }
}
