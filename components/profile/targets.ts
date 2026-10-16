import { formatWeight, fromDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { profileSchema } from '../../lib/schema/profile'

import type { Profile } from '../../lib/db/dexie'
import type { UnitSystem } from '../../lib/schema/profile'

export type TargetField =
  'step_goal' | 'calorie_goal' | 'sessions_per_week_goal' | 'target_weight_kg' | 'height_cm'

export const TARGET_FIELDS: readonly TargetField[] = [
  'step_goal',
  'calorie_goal',
  'sessions_per_week_goal',
  'target_weight_kg',
  'height_cm',
]

export type DurationTarget = 'gym_goal_seconds' | 'walk_goal_seconds'

export const DURATION_TARGETS: readonly DurationTarget[] = ['gym_goal_seconds', 'walk_goal_seconds']

export const GOAL_PRESETS: Record<DurationTarget, readonly number[]> = {
  gym_goal_seconds: [2700, 3600, 5400, 7200],
  walk_goal_seconds: [1800, 2700, 3600, 5400],
}

export const GOAL_STEP_SECONDS = 300

export const GOAL_MIN_SECONDS = 300

export const GOAL_TOO_SHORT = `A time goal must be at least ${String(GOAL_MIN_SECONDS / 60)} minutes.`

export const GOAL_MAX_SECONDS = 86400

export type TargetParse = { ok: true; patch: Partial<Profile> } | { ok: false; message: string }

const LABEL: Record<Exclude<TargetField, 'target_weight_kg'>, string> = {
  step_goal: 'Daily step goal',
  calorie_goal: 'Daily calorie goal (kcal)',
  sessions_per_week_goal: 'Sessions per week goal',
  height_cm: 'Height (cm)',
}

const DURATION_LABEL: Record<DurationTarget, string> = {
  gym_goal_seconds: 'Daily gym time goal',
  walk_goal_seconds: 'Daily walk time goal',
}

export function targetLabel(field: TargetField, unit: UnitSystem): string {
  return field === 'target_weight_kg' ? `Target weight (${weightSymbol(unit)})` : LABEL[field]
}

export function durationLabel(field: DurationTarget): string {
  return DURATION_LABEL[field]
}

export function targetText(profile: Profile, field: TargetField, unit: UnitSystem): string {
  if (field === 'target_weight_kg') {
    const kg = profile.target_weight_kg

    return kg === null ? '' : formatWeight(kg, unit, 1)
  }

  const value = profile[field] ?? null

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

function checked(field: TargetField | DurationTarget, value: unknown): TargetParse {
  const result = profileSchema.shape[field].safeParse(value)

  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? 'Check this value.' }
  }

  return { ok: true, patch: { [field]: result.data } }
}

export function parseTarget(field: TargetField, text: string, unit: UnitSystem): TargetParse {
  const value = toStored(field, readNumber(text), unit)

  return checked(field, value ?? (field === 'step_goal' ? NaN : null))
}

export function parseDurationTarget(field: DurationTarget, seconds: number | null): TargetParse {
  if (seconds !== null && seconds < GOAL_MIN_SECONDS) {
    return { ok: false, message: GOAL_TOO_SHORT }
  }

  return checked(field, seconds)
}
