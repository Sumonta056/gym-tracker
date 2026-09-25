import type { DailyEntry, Profile } from '../../lib/db/dexie'

export const NOW = new Date(2026, 8, 23, 10, 0, 0)

export const TODAY = '2026-09-23'

export function entryOn(date: string, patch: Partial<DailyEntry> = {}): DailyEntry {
  return {
    id: `00000000-0000-4000-8000-${date.replaceAll('-', '').padStart(12, '0')}`,
    entry_date: date,
    walk_seconds: 3324,
    gym_seconds: 4325,
    avg_heart_rate: 117,
    max_heart_rate: 174,
    weight_kg: 73.65,
    calories_burnt: 963,
    steps: 5909,
    note: null,
    created_at: `${date}T10:00:00.000Z`,
    updated_at: `${date}T10:00:00.000Z`,
    deleted_at: null,
    ...patch,
  }
}

export const PROFILE: Profile = {
  id: '00000000-0000-4000-8000-000000000000',
  display_name: 'Sumonta',
  unit_system: 'metric',
  height_cm: null,
  target_weight_kg: null,
  step_goal: 12000,
  updated_at: '2026-09-01T00:00:00.000Z',
}
