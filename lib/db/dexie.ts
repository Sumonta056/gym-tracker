import Dexie, { type EntityTable } from 'dexie'

import type { DailyEntryInput } from '../schema/dailyEntry'
import type { ErrorRecord } from '../schema/errorRecord'
import type { ExerciseInput } from '../schema/exercise'
import type { ProfileInput } from '../schema/profile'
import type { WorkoutSessionInput } from '../schema/workoutSession'
import type { WorkoutSetInput } from '../schema/workoutSet'

export interface DailyEntry
  extends Omit<DailyEntryInput, 'swim_seconds'>, Partial<Pick<DailyEntryInput, 'swim_seconds'>> {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type RestSettings = 'rest_sound_muted' | 'rest_seconds_by_exercise'

type GoalSettings =
  | 'calorie_goal'
  | 'gym_goal_seconds'
  | 'walk_goal_seconds'
  | 'sessions_per_week_goal'
  | 'birth_year'
  | 'max_heart_rate'
  | 'stats_layout'

type LaterProfileFields = RestSettings | GoalSettings

export interface Profile
  extends Omit<ProfileInput, LaterProfileFields>, Partial<Pick<ProfileInput, LaterProfileFields>> {
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
  errorLog: EntityTable<ErrorRecord, 'id'>
}

export const OUTBOX_SEQUENCE_KEY = 'outbox_sequence'

export const DAILY_CURSOR_KEY = 'pull_cursor_daily_entries'

export const DAILY_PULLED_KEY = 'pulled_daily_entries'

export const PROFILE_CURSOR_KEY = 'pull_cursor_profiles'

export const EXERCISE_CURSOR_KEY = 'pull_cursor_exercises'

export const SESSION_CURSOR_KEY = 'pull_cursor_workout_sessions'

export const SET_CURSOR_KEY = 'pull_cursor_workout_sets'

export const DEAD_STREAK_KEY = 'dead_letter_streak'

export const SIGNED_OUT_KEY = 'signed_out'

export const LOCAL_PROFILE_ID = '00000000-0000-4000-8000-000000000000'

export const NEVER_WRITTEN = new Date(0).toISOString()

export const DATABASE_NAME = 'gym-tracker'

export const DATABASE_VERSION = 5

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

export const STORES_V3 = {
  ...STORES_V2,
  exercises: '&id, muscle_group, updated_at',
  workoutSessions: '&id, entry_date, status, updated_at',
  workoutSets: '&id, session_id, updated_at',
} as const

export const STORES_V4 = {
  ...STORES_V3,
  errorLog: '&id, at',
} as const

export const STORES = { ...STORES_V4 } as const

export type VersionState = 'current' | 'stale' | 'blocked'

export interface VersionWatch {
  get: () => VersionState
  subscribe: (listener: () => void) => () => void
  set: (next: VersionState) => void
}

export function createVersionWatch(): VersionWatch {
  let state: VersionState = 'current'
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    set: (next) => {
      if (next === state) {
        return
      }

      state = next

      for (const listener of listeners) {
        listener()
      }
    },
  }
}

export const versionWatch = createVersionWatch()

export function getVersionState(): VersionState {
  return versionWatch.get()
}

export function subscribeVersionState(listener: () => void): () => void {
  return versionWatch.subscribe(listener)
}

export function createDatabase(
  name: string = DATABASE_NAME,
  watch: VersionWatch = versionWatch,
): GymDatabase {
  const instance = new Dexie(name) as GymDatabase

  instance.version(1).stores(STORES_V1)
  instance.version(2).stores(STORES_V2)
  instance.version(3).stores(STORES_V3)
  instance.version(4).stores(STORES_V4)
  instance.version(DATABASE_VERSION).stores(STORES)

  instance.on('versionchange', () => {
    instance.close({ disableAutoOpen: true })
    watch.set('stale')

    return false
  })
  instance.on('blocked', () => {
    watch.set('blocked')
  })
  instance.on(
    'ready',
    () => {
      if (watch.get() === 'blocked') {
        watch.set('current')
      }
    },
    true,
  )

  return instance
}

export const db = createDatabase()
