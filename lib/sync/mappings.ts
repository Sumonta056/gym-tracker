import { LOCAL_PROFILE_ID } from '../db/dexie'
import { muscleGroupSchema } from '../schema/exercise'
import { profileSchema } from '../schema/profile'
import { MIN_REPS } from '../schema/workoutSet'

import type { DailyEntry, Exercise, Profile, WorkoutSession, WorkoutSet } from '../db/dexie'
import type { Tables, TablesInsert } from '../supabase/database.types'

export function toServerEntry(payload: DailyEntry, userId: string): TablesInsert<'daily_entries'> {
  return {
    id: payload.id,
    user_id: userId,
    entry_date: payload.entry_date,
    walk_seconds: payload.walk_seconds,
    gym_seconds: payload.gym_seconds,
    avg_heart_rate: payload.avg_heart_rate,
    max_heart_rate: payload.max_heart_rate,
    weight_kg: payload.weight_kg,
    calories_burnt: payload.calories_burnt,
    steps: payload.steps,
    note: payload.note,
    created_at: payload.created_at,
    deleted_at: payload.deleted_at,
  }
}

export function toServerProfile(payload: Profile, userId: string): TablesInsert<'profiles'> {
  return {
    id: userId,
    display_name: payload.display_name,
    unit_system: payload.unit_system,
    height_cm: payload.height_cm,
    target_weight_kg: payload.target_weight_kg,
    step_goal: payload.step_goal,
    rest_sound_muted: payload.rest_sound_muted,
    rest_seconds_by_exercise: payload.rest_seconds_by_exercise,
  }
}

export function toServerExercise(payload: Exercise, userId: string): TablesInsert<'exercises'> {
  return {
    id: payload.id,
    user_id: userId,
    name: payload.name,
    muscle_group: payload.muscle_group,
    is_archived: payload.is_archived,
    created_at: payload.created_at,
    deleted_at: payload.deleted_at,
  }
}

export function toServerSession(
  payload: WorkoutSession,
  userId: string,
): TablesInsert<'workout_sessions'> {
  return {
    id: payload.id,
    user_id: userId,
    entry_date: payload.entry_date,
    started_at: payload.started_at,
    ended_at: payload.ended_at,
    status: payload.status,
    created_at: payload.created_at,
    deleted_at: payload.deleted_at,
  }
}

export function toServerSet(payload: WorkoutSet): TablesInsert<'workout_sets'> {
  return {
    id: payload.id,
    session_id: payload.session_id,
    exercise_id: payload.exercise_id,
    set_index: payload.set_index,
    reps: payload.reps,
    weight_kg: payload.weight_kg,
    rpe: payload.rpe,
    completed_at: payload.completed_at,
    created_at: payload.created_at,
    deleted_at: payload.deleted_at,
  }
}

export function toLocalEntry(row: Tables<'daily_entries'>): DailyEntry {
  return {
    id: row.id,
    entry_date: row.entry_date,
    walk_seconds: row.walk_seconds,
    gym_seconds: row.gym_seconds,
    avg_heart_rate: row.avg_heart_rate,
    max_heart_rate: row.max_heart_rate,
    weight_kg: row.weight_kg,
    calories_burnt: row.calories_burnt,
    steps: row.steps,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

export function toLocalProfile(row: Tables<'profiles'>): Profile {
  return {
    id: LOCAL_PROFILE_ID,
    display_name: row.display_name,
    unit_system: row.unit_system === 'imperial' ? 'imperial' : 'metric',
    height_cm: row.height_cm,
    target_weight_kg: row.target_weight_kg,
    step_goal: row.step_goal,
    rest_sound_muted:
      profileSchema.shape.rest_sound_muted.safeParse(row.rest_sound_muted).data ?? false,
    rest_seconds_by_exercise:
      profileSchema.shape.rest_seconds_by_exercise.safeParse(row.rest_seconds_by_exercise).data ??
      {},
    updated_at: row.updated_at,
  }
}

export function toLocalExercise(row: Tables<'exercises'>): Exercise {
  return {
    id: row.id,
    user_id: row.user_id === null ? null : LOCAL_PROFILE_ID,
    name: row.name,
    muscle_group: muscleGroupSchema.safeParse(row.muscle_group).data ?? 'core',
    is_archived: row.is_archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

export function toLocalSession(row: Tables<'workout_sessions'>): WorkoutSession {
  return {
    id: row.id,
    entry_date: row.entry_date,
    started_at: row.started_at,
    ended_at: row.ended_at,
    status: row.status === 'active' ? 'active' : 'finished',
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

export function toLocalSet(row: Tables<'workout_sets'>): WorkoutSet {
  return {
    id: row.id,
    session_id: row.session_id,
    exercise_id: row.exercise_id,
    set_index: row.set_index,
    reps: row.reps ?? MIN_REPS,
    weight_kg: row.weight_kg,
    rpe: row.rpe,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}
