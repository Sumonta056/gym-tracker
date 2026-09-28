import { describe, expect, it } from 'vitest'

import { LOCAL_PROFILE_ID } from '../db/dexie'
import { dailyEntrySchema } from '../schema/dailyEntry'
import { exerciseSchema } from '../schema/exercise'
import { profileSchema } from '../schema/profile'
import { workoutSessionSchema } from '../schema/workoutSession'
import { workoutSetSchema } from '../schema/workoutSet'

import {
  toLocalEntry,
  toLocalExercise,
  toLocalProfile,
  toLocalSession,
  toLocalSet,
  toServerEntry,
  toServerExercise,
  toServerProfile,
  toServerSession,
  toServerSet,
} from './mappings'

import type { DailyEntry, Exercise, Profile, WorkoutSession, WorkoutSet } from '../db/dexie'
import type { Tables } from '../supabase/database.types'

const USER_ID = '99999999-9999-4999-8999-999999999999'
const ROW_A = '11111111-1111-4111-8111-111111111111'
const ROW_C = '33333333-3333-4333-8333-333333333333'
const ROW_D = '44444444-4444-4444-8444-444444444444'
const LOCAL_AT = '2026-09-01T10:00:00.000Z'
const SERVER_AT = '2026-09-01T11:00:00.000Z'

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    ...exerciseSchema.parse({ name: 'Cable Fly', muscle_group: 'chest' }),
    id: ROW_C,
    user_id: LOCAL_PROFILE_ID,
    created_at: LOCAL_AT,
    updated_at: LOCAL_AT,
    deleted_at: null,
    ...overrides,
  }
}

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    ...workoutSessionSchema.parse({ entry_date: '2026-09-01', started_at: LOCAL_AT }),
    id: ROW_D,
    created_at: LOCAL_AT,
    updated_at: LOCAL_AT,
    deleted_at: null,
    ...overrides,
  }
}

function set(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    ...workoutSetSchema.parse({
      session_id: ROW_D,
      exercise_id: ROW_C,
      set_index: 2,
      reps: 8,
      weight_kg: 62.5,
      rpe: 8,
      completed_at: LOCAL_AT,
    }),
    id: ROW_A,
    created_at: LOCAL_AT,
    updated_at: LOCAL_AT,
    deleted_at: null,
    ...overrides,
  }
}

function serverExercise(overrides: Partial<Tables<'exercises'>> = {}): Tables<'exercises'> {
  return {
    id: ROW_C,
    user_id: USER_ID,
    name: 'Cable Fly',
    muscle_group: 'chest',
    is_archived: false,
    created_at: LOCAL_AT,
    updated_at: SERVER_AT,
    deleted_at: null,
    ...overrides,
  }
}

function serverSession(
  overrides: Partial<Tables<'workout_sessions'>> = {},
): Tables<'workout_sessions'> {
  return {
    id: ROW_D,
    user_id: USER_ID,
    entry_date: '2026-09-01',
    started_at: LOCAL_AT,
    ended_at: null,
    status: 'active',
    created_at: LOCAL_AT,
    updated_at: SERVER_AT,
    deleted_at: null,
    ...overrides,
  }
}

function serverSet(overrides: Partial<Tables<'workout_sets'>> = {}): Tables<'workout_sets'> {
  return {
    id: ROW_A,
    session_id: ROW_D,
    exercise_id: ROW_C,
    set_index: 2,
    reps: 8,
    weight_kg: 62.5,
    rpe: 8,
    completed_at: LOCAL_AT,
    created_at: LOCAL_AT,
    updated_at: SERVER_AT,
    deleted_at: null,
    ...overrides,
  }
}

describe('toServerEntry', () => {
  it('fills the owner column and leaves updated_at to the server', () => {
    const entry: DailyEntry = {
      ...dailyEntrySchema.parse({ entry_date: '2026-09-01' }),
      id: ROW_A,
      created_at: LOCAL_AT,
      updated_at: LOCAL_AT,
      deleted_at: null,
    }

    const row = toServerEntry(entry, USER_ID)

    expect(row.user_id).toBe(USER_ID)
    expect('updated_at' in row).toBe(false)
  })
})

describe('toLocalEntry', () => {
  it('drops the owner column', () => {
    const row = toLocalEntry({
      ...dailyEntrySchema.parse({ entry_date: '2026-09-01' }),
      id: ROW_A,
      user_id: USER_ID,
      created_at: LOCAL_AT,
      updated_at: SERVER_AT,
      deleted_at: null,
    })

    expect('user_id' in row).toBe(false)
  })
})

describe('toServerProfile and toLocalProfile', () => {
  it('round trips the rest settings through the server shape', () => {
    const local: Profile = {
      ...profileSchema.parse({}),
      id: LOCAL_PROFILE_ID,
      rest_sound_muted: true,
      rest_seconds_by_exercise: { [ROW_C]: 150 },
      updated_at: LOCAL_AT,
    }

    const sent = toServerProfile(local, USER_ID)
    const back = toLocalProfile({
      ...sent,
      id: USER_ID,
      display_name: sent.display_name ?? null,
      unit_system: sent.unit_system ?? 'metric',
      height_cm: sent.height_cm ?? null,
      target_weight_kg: sent.target_weight_kg ?? null,
      step_goal: sent.step_goal ?? 10000,
      rest_sound_muted: sent.rest_sound_muted ?? false,
      rest_seconds_by_exercise: sent.rest_seconds_by_exercise ?? {},
      created_at: LOCAL_AT,
      updated_at: SERVER_AT,
    })

    expect(sent.id).toBe(USER_ID)
    expect(back).toMatchObject({
      id: LOCAL_PROFILE_ID,
      rest_sound_muted: true,
      rest_seconds_by_exercise: { [ROW_C]: 150 },
    })
  })
})

describe('toServerExercise', () => {
  it('swaps the local owner sentinel for the session user id', () => {
    expect(toServerExercise(exercise(), USER_ID).user_id).toBe(USER_ID)
  })

  it('sends every field of the exercise but updated_at', () => {
    expect(
      toServerExercise(exercise({ is_archived: true, deleted_at: SERVER_AT }), USER_ID),
    ).toEqual({
      id: ROW_C,
      user_id: USER_ID,
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: true,
      created_at: LOCAL_AT,
      deleted_at: SERVER_AT,
    })
  })
})

describe('toLocalExercise', () => {
  it('maps an own server exercise back to the local owner sentinel', () => {
    expect(toLocalExercise(serverExercise()).user_id).toBe(LOCAL_PROFILE_ID)
  })

  it('keeps the null owner of a global seed row', () => {
    expect(toLocalExercise(serverExercise({ user_id: null })).user_id).toBeNull()
  })

  it('keeps every field and the server updated_at', () => {
    expect(toLocalExercise(serverExercise({ is_archived: true, muscle_group: 'legs' }))).toEqual({
      id: ROW_C,
      user_id: LOCAL_PROFILE_ID,
      name: 'Cable Fly',
      muscle_group: 'legs',
      is_archived: true,
      created_at: LOCAL_AT,
      updated_at: SERVER_AT,
      deleted_at: null,
    })
  })

  it('falls back to core when the server muscle group is not a known value', () => {
    expect(toLocalExercise(serverExercise({ muscle_group: 'neck' })).muscle_group).toBe('core')
  })
})

describe('toServerSession', () => {
  it('fills the owner column from the session user id and leaves updated_at out', () => {
    expect(toServerSession(session({ status: 'finished', ended_at: SERVER_AT }), USER_ID)).toEqual({
      id: ROW_D,
      user_id: USER_ID,
      entry_date: '2026-09-01',
      started_at: LOCAL_AT,
      ended_at: SERVER_AT,
      status: 'finished',
      created_at: LOCAL_AT,
      deleted_at: null,
    })
  })
})

describe('toLocalSession', () => {
  it('drops the owner column and keeps the server updated_at', () => {
    expect(toLocalSession(serverSession())).toEqual({
      id: ROW_D,
      entry_date: '2026-09-01',
      started_at: LOCAL_AT,
      ended_at: null,
      status: 'active',
      created_at: LOCAL_AT,
      updated_at: SERVER_AT,
      deleted_at: null,
    })
  })

  it('keeps a finished status', () => {
    expect(toLocalSession(serverSession({ status: 'finished', ended_at: SERVER_AT })).status).toBe(
      'finished',
    )
  })

  it('reads a status it does not know as finished, so it never claims the one active slot', () => {
    expect(toLocalSession(serverSession({ status: 'paused' })).status).toBe('finished')
  })
})

describe('toServerSet', () => {
  it('sends no owner column, since a set belongs to its session', () => {
    const row = toServerSet(set())

    expect('user_id' in row).toBe(false)
  })

  it('sends every field of the set but updated_at', () => {
    expect(toServerSet(set({ deleted_at: SERVER_AT }))).toEqual({
      id: ROW_A,
      session_id: ROW_D,
      exercise_id: ROW_C,
      set_index: 2,
      reps: 8,
      weight_kg: 62.5,
      rpe: 8,
      completed_at: LOCAL_AT,
      created_at: LOCAL_AT,
      deleted_at: SERVER_AT,
    })
  })
})

describe('toLocalSet', () => {
  it('keeps every field and the server updated_at', () => {
    expect(toLocalSet(serverSet())).toEqual({
      id: ROW_A,
      session_id: ROW_D,
      exercise_id: ROW_C,
      set_index: 2,
      reps: 8,
      weight_kg: 62.5,
      rpe: 8,
      completed_at: LOCAL_AT,
      created_at: LOCAL_AT,
      updated_at: SERVER_AT,
      deleted_at: null,
    })
  })

  it('keeps a null load', () => {
    expect(toLocalSet(serverSet({ weight_kg: null })).weight_kg).toBeNull()
  })

  it('reads missing reps as the lowest valid count', () => {
    expect(toLocalSet(serverSet({ reps: null })).reps).toBe(1)
  })
})
