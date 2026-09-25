import Dexie, { type EntityTable } from 'dexie'

import type { DailyEntryInput } from '../schema/dailyEntry'
import type { ProfileInput } from '../schema/profile'

export interface DailyEntry extends DailyEntryInput {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Profile extends ProfileInput {
  id: string
  updated_at: string
}

export type OutboxTableName = 'daily_entries' | 'profiles'

export type OutboxOperation = 'upsert' | 'delete'

export interface OutboxEntry {
  id: string
  sequence: number
  table_name: OutboxTableName
  operation: OutboxOperation
  row_id: string
  payload: DailyEntry | Profile
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
}

export const OUTBOX_SEQUENCE_KEY = 'outbox_sequence'

export const DAILY_CURSOR_KEY = 'pull_cursor_daily_entries'

export const PROFILE_CURSOR_KEY = 'pull_cursor_profiles'

export const DEAD_STREAK_KEY = 'dead_letter_streak'

export const SIGNED_OUT_KEY = 'signed_out'

export const LOCAL_PROFILE_ID = '00000000-0000-4000-8000-000000000000'

export const NEVER_WRITTEN = new Date(0).toISOString()

export const DATABASE_NAME = 'gym-tracker'

export const DATABASE_VERSION = 2

export const STORES_V1 = {
  dailyEntries: '&id, entry_date, updated_at',
  profiles: '&id, updated_at',
  outbox: '&id, &sequence, table_name',
  syncMeta: '&key',
} as const

export const STORES = {
  ...STORES_V1,
  deadLetters: '&id, sequence',
} as const

export function createDatabase(name: string = DATABASE_NAME): GymDatabase {
  const instance = new Dexie(name) as GymDatabase

  instance.version(1).stores(STORES_V1)
  instance.version(DATABASE_VERSION).stores(STORES)

  return instance
}

export const db = createDatabase()
