import Dexie, { type EntityTable } from 'dexie'

import type { DailyEntryInput } from '../schema/dailyEntry'
import type { ExerciseInput } from '../schema/exercise'
import type { ProfileInput } from '../schema/profile'
import type { WorkoutSessionInput } from '../schema/workoutSession'
import type { WorkoutSetInput } from '../schema/workoutSet'

export interface DailyEntry extends DailyEntryInput {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type RestSettings = 'rest_sound_muted' | 'rest_seconds_by_exercise'

export interface Profile
  extends Omit<ProfileInput, RestSettings>, Partial<Pick<ProfileInput, RestSettings>> {
  id: string
  updated_at: string
}

export interface Exercise extends ExerciseInput {
  id: string
  user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface WorkoutSession extends WorkoutSessionInput {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface WorkoutSet extends WorkoutSetInput {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type OutboxTableName =
  'daily_entries' | 'profiles' | 'exercises' | 'workout_sessions' | 'workout_sets'

export type OutboxPayload = DailyEntry | Profile | Exercise | WorkoutSession | WorkoutSet

export type OutboxOperation = 'upsert' | 'delete'

export interface OutboxEntry {
  id: string
  sequence: number
  table_name: OutboxTableName
  operation: OutboxOperation
  row_id: string
  payload: OutboxPayload
  created_at: string
  attempts: number
  last_error: string | null
  next_attempt_at: string | null
}

export interface DeadLetter extends OutboxEntry {
  error_code: string | null
  failed_at: string
}

export interface SyncMetaRecord {
  key: string
  value: string | null
}

export type GymDatabase = Dexie & {
  dailyEntries: EntityTable<DailyEntry, 'id'>
  profiles: EntityTable<Profile, 'id'>
  outbox: EntityTable<OutboxEntry, 'id'>
  deadLetters: EntityTable<DeadLetter, 'id'>
  syncMeta: EntityTable<SyncMetaRecord, 'key'>
  exercises: EntityTable<Exercise, 'id'>
  workoutSessions: EntityTable<WorkoutSession, 'id'>
  workoutSets: EntityTable<WorkoutSet, 'id'>
}

export const OUTBOX_SEQUENCE_KEY = 'outbox_sequence'

export const DAILY_CURSOR_KEY = 'pull_cursor_daily_entries'

export const PROFILE_CURSOR_KEY = 'pull_cursor_profiles'

export const EXERCISE_CURSOR_KEY = 'pull_cursor_exercises'

export const SESSION_CURSOR_KEY = 'pull_cursor_workout_sessions'

export const SET_CURSOR_KEY = 'pull_cursor_workout_sets'

export const DEAD_STREAK_KEY = 'dead_letter_streak'

export const SIGNED_OUT_KEY = 'signed_out'

export const LOCAL_PROFILE_ID = '00000000-0000-4000-8000-000000000000'

export const NEVER_WRITTEN = new Date(0).toISOString()

export const DATABASE_NAME = 'gym-tracker'

export const DATABASE_VERSION = 3

export const STORES_V1 = {
  dailyEntries: '&id, entry_date, updated_at',
  profiles: '&id, updated_at',
  outbox: '&id, &sequence, table_name',
  syncMeta: '&key',
} as const

export const STORES_V2 = {
  ...STORES_V1,
  deadLetters: '&id, sequence',
} as const

export const STORES = {
  ...STORES_V2,
  exercises: '&id, muscle_group, updated_at',
  workoutSessions: '&id, entry_date, status, updated_at',
  workoutSets: '&id, session_id, updated_at',
} as const

export function createDatabase(name: string = DATABASE_NAME): GymDatabase {
  const instance = new Dexie(name) as GymDatabase

  instance.version(1).stores(STORES_V1)
  instance.version(2).stores(STORES_V2)
  instance.version(DATABASE_VERSION).stores(STORES)

  return instance
}

export const db = createDatabase()
