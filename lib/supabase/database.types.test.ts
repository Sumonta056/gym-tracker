import { describe, expect, it } from 'vitest'

import { Constants } from './database.types'

import type { Tables, TablesInsert, TablesUpdate } from './database.types'

type DailyEntryRow = Tables<'daily_entries'>
type ProfileRow = Tables<'profiles'>

const DAILY_ENTRY_COLUMNS: Record<keyof DailyEntryRow, true> = {
  id: true,
  user_id: true,
  entry_date: true,
  walk_seconds: true,
  gym_seconds: true,
  avg_heart_rate: true,
  max_heart_rate: true,
  weight_kg: true,
  calories_burnt: true,
  steps: true,
  note: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}

const PROFILE_COLUMNS: Record<keyof ProfileRow, true> = {
  id: true,
  display_name: true,
  unit_system: true,
  height_cm: true,
  target_weight_kg: true,
  step_goal: true,
  created_at: true,
  updated_at: true,
}

describe('database.types', () => {
  it('gives daily_entries every column from migration 0001', () => {
    expect(Object.keys(DAILY_ENTRY_COLUMNS).sort()).toEqual(
      [
        'avg_heart_rate',
        'calories_burnt',
        'created_at',
        'deleted_at',
        'entry_date',
        'gym_seconds',
        'id',
        'max_heart_rate',
        'note',
        'steps',
        'updated_at',
        'user_id',
        'walk_seconds',
        'weight_kg',
      ].sort(),
    )
  })

  it('gives profiles every column from migration 0001', () => {
    expect(Object.keys(PROFILE_COLUMNS).sort()).toEqual(
      [
        'created_at',
        'display_name',
        'height_cm',
        'id',
        'step_goal',
        'target_weight_kg',
        'unit_system',
        'updated_at',
      ].sort(),
    )
  })

  it('requires the client to supply the id on an insert', () => {
    const insert: TablesInsert<'daily_entries'> = {
      id: '00000000-0000-4000-8000-000000000000',
      user_id: '00000000-0000-4000-8000-000000000001',
      entry_date: '2026-09-21',
    }
    expect(insert.id).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('allows a soft delete through an update', () => {
    const update: TablesUpdate<'daily_entries'> = { deleted_at: '2026-09-21T00:00:00.000Z' }
    expect(update.deleted_at).toBe('2026-09-21T00:00:00.000Z')
  })

  it('exposes no enums', () => {
    expect(Constants.public.Enums).toEqual({})
  })
})
