import { describe, expect, it } from 'vitest'

import { Constants } from './database.types'

import type { Tables, TablesInsert, TablesUpdate } from './database.types'

type DailyEntryRow = Tables<'daily_entries'>
type ProfileRow = Tables<'profiles'>
type ExerciseRow = Tables<'exercises'>
type WorkoutSessionRow = Tables<'workout_sessions'>
type WorkoutSetRow = Tables<'workout_sets'>

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
  rest_sound_muted: true,
  rest_seconds_by_exercise: true,
  created_at: true,
  updated_at: true,
}

const EXERCISE_COLUMNS: Record<keyof ExerciseRow, true> = {
  id: true,
  user_id: true,
  name: true,
  muscle_group: true,
  is_archived: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}

const WORKOUT_SESSION_COLUMNS: Record<keyof WorkoutSessionRow, true> = {
  id: true,
  user_id: true,
  entry_date: true,
  started_at: true,
  ended_at: true,
  status: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}

const WORKOUT_SET_COLUMNS: Record<keyof WorkoutSetRow, true> = {
  id: true,
  session_id: true,
  exercise_id: true,
  set_index: true,
  reps: true,
  weight_kg: true,
  rpe: true,
  completed_at: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
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

  it('gives profiles every column from migration 0001 and the two rest columns', () => {
    expect(Object.keys(PROFILE_COLUMNS).sort()).toEqual(
      [
        'created_at',
        'display_name',
        'height_cm',
        'id',
        'rest_seconds_by_exercise',
        'rest_sound_muted',
        'step_goal',
        'target_weight_kg',
        'unit_system',
        'updated_at',
      ].sort(),
    )
  })

  it('lets an exercise carry a null user_id as a global seed row', () => {
    const global: TablesInsert<'exercises'> = {
      id: '00000000-0000-4000-8000-000000000002',
      user_id: null,
      name: 'Back squat',
      muscle_group: 'legs',
    }
    expect(Object.keys(EXERCISE_COLUMNS)).toHaveLength(8)
    expect(global.user_id).toBeNull()
  })

  it('gives workout_sessions every column of the specification', () => {
    expect(Object.keys(WORKOUT_SESSION_COLUMNS).sort()).toEqual(
      [
        'created_at',
        'deleted_at',
        'ended_at',
        'entry_date',
        'id',
        'started_at',
        'status',
        'updated_at',
        'user_id',
      ].sort(),
    )
  })

  it('gives workout_sets no user_id, because ownership reads the parent session', () => {
    expect(Object.keys(WORKOUT_SET_COLUMNS)).not.toContain('user_id')
    expect(Object.keys(WORKOUT_SET_COLUMNS)).toHaveLength(11)
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
