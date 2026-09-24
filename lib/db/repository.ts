import { newId } from '../id'
import { dailyEntrySchema } from '../schema/dailyEntry'
import { profileSchema } from '../schema/profile'
import { append as enqueue, lastSequence } from '../sync/outbox'
import { endSigningOut, haltSync, markSigningOut, resumeSync, withDrainLock } from '../sync/worker'

import { db, LOCAL_PROFILE_ID, NEVER_WRITTEN } from './dexie'

import type { DailyEntry, Profile } from './dexie'
import type { DailyEntryInput } from '../schema/dailyEntry'
import type { ProfileInput } from '../schema/profile'

export { LOCAL_PROFILE_ID, NEVER_WRITTEN, OUTBOX_SEQUENCE_KEY } from './dexie'

export { useDeadLetters, useSyncStatus } from '../sync/useSyncStatus'

export type { SyncStatus, SyncStatusReport } from '../sync/useSyncStatus'

export { drainForSignOut, haltSync, resumeSync, startSync, sync as syncNow } from '../sync/worker'

export { lastSequence as outboxSequence, pendingCount as pendingWrites } from '../sync/outbox'

export {
  deadLetterCount as failedWrites,
  discardDeadLetter,
  listDeadLetters,
  retryDeadLetter,
} from '../sync/deadLetters'

export type { SyncOutcome } from '../sync/worker'

const PROFILE_FIELDS = [
  'display_name',
  'unit_system',
  'height_cm',
  'target_weight_kg',
  'step_goal',
] as const

function nowIso(): string {
  return new Date().toISOString()
}

function newerFirst(left: DailyEntry, right: DailyEntry): number {
  return right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)
}

function liveRow(rows: DailyEntry[]): DailyEntry | undefined {
  return rows.filter((row) => row.deleted_at === null).sort(newerFirst)[0]
}

async function rowsForDate(date: string): Promise<DailyEntry[]> {
  return db.dailyEntries.where('entry_date').equals(date).toArray()
}

async function rowForDate(date: string): Promise<DailyEntry | undefined> {
  const rows = await rowsForDate(date)

  return liveRow(rows) ?? rows[0]
}

async function keepOneLiveRow(date: string, timestamp: string): Promise<DailyEntry | undefined> {
  const rows = await rowsForDate(date)
  const winner = liveRow(rows)

  for (const row of rows) {
    if (row.deleted_at !== null || row.id === winner?.id) {
      continue
    }

    const loser: DailyEntry = { ...row, updated_at: timestamp, deleted_at: timestamp }

    await db.dailyEntries.put(loser)
    await enqueue('daily_entries', 'delete', loser)
  }

  return winner ?? rows[0]
}

export async function getDay(date: string): Promise<DailyEntry | undefined> {
  const row = await rowForDate(date)

  if (row === undefined || row.deleted_at !== null) {
    return undefined
  }

  return row
}

export async function listRange(from: string, to: string): Promise<DailyEntry[]> {
  const rows = await db.dailyEntries.where('entry_date').between(from, to, true, true).toArray()
  const winners = new Map<string, DailyEntry>()

  for (const row of rows) {
    if (row.deleted_at !== null) {
      continue
    }

    const current = winners.get(row.entry_date)

    if (current === undefined || newerFirst(row, current) < 0) {
      winners.set(row.entry_date, row)
    }
  }

  return [...winners.values()].sort((left, right) =>
    left.entry_date.localeCompare(right.entry_date),
  )
}

export async function upsertDay(input: DailyEntryInput): Promise<DailyEntry> {
  const parsed = dailyEntrySchema.parse(input)
  const timestamp = nowIso()

  return db.transaction('rw', db.dailyEntries, db.outbox, db.syncMeta, async () => {
    const existing = await keepOneLiveRow(parsed.entry_date, timestamp)

    const row: DailyEntry = {
      ...parsed,
      id: existing?.id ?? newId(),
      created_at: existing?.created_at ?? timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }

    await db.dailyEntries.put(row)
    await enqueue('daily_entries', 'upsert', row)

    return row
  })
}

export async function softDeleteDay(date: string): Promise<void> {
  const timestamp = nowIso()

  await db.transaction('rw', db.dailyEntries, db.outbox, db.syncMeta, async () => {
    const existing = await keepOneLiveRow(date, timestamp)

    if (existing === undefined || existing.deleted_at !== null) {
      return
    }

    const row: DailyEntry = { ...existing, updated_at: timestamp, deleted_at: timestamp }

    await db.dailyEntries.put(row)
    await enqueue('daily_entries', 'delete', row)
  })
}

function profileValues(source: Partial<Profile>): Partial<ProfileInput> {
  const values: Record<string, unknown> = {}

  for (const field of PROFILE_FIELDS) {
    if (source[field] !== undefined) {
      values[field] = source[field]
    }
  }

  return values
}

function defaultProfile(): Profile {
  return { ...profileSchema.parse({}), id: LOCAL_PROFILE_ID, updated_at: NEVER_WRITTEN }
}

export async function getProfile(): Promise<Profile> {
  const row = await db.profiles.get(LOCAL_PROFILE_ID)

  if (row !== undefined) {
    return row
  }

  return defaultProfile()
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const patched = profileValues(patch)

  profileSchema.partial().parse(patched)

  return db.transaction('rw', db.profiles, db.outbox, db.syncMeta, async () => {
    const stored = await db.profiles.get(LOCAL_PROFILE_ID)
    const parsed = profileSchema.parse({
      ...profileValues(stored ?? defaultProfile()),
      ...patched,
    })
    const row: Profile = { ...parsed, id: LOCAL_PROFILE_ID, updated_at: nowIso() }

    await db.profiles.put(row)
    await enqueue('profiles', 'upsert', row)

    return row
  })
}

export interface ConfirmedWrites {
  count: number
  sequence: number
}

export class UnsyncedWritesChanged extends Error {
  constructor(
    readonly count: number,
    readonly sequence: number,
  ) {
    super(`${String(count)} unsynced writes wait on this device`)
    this.name = 'UnsyncedWritesChanged'
  }
}

export async function clearAll<T>(
  confirmed: ConfirmedWrites,
  endSession: () => Promise<T>,
): Promise<T> {
  await haltSync()
  markSigningOut()

  try {
    return await withDrainLock(async () => {
      await db.transaction(
        'rw',
        [db.dailyEntries, db.profiles, db.outbox, db.deadLetters, db.syncMeta],
        async () => {
          const count = (await db.outbox.count()) + (await db.deadLetters.count())
          const sequence = await lastSequence()

          if (count > confirmed.count || sequence > confirmed.sequence) {
            throw new UnsyncedWritesChanged(count, sequence)
          }

          await Promise.all([
            db.dailyEntries.clear(),
            db.profiles.clear(),
            db.outbox.clear(),
            db.deadLetters.clear(),
            db.syncMeta.clear(),
          ])
        },
      )

      return endSession()
    })
  } catch (cause) {
    if (cause instanceof UnsyncedWritesChanged) {
      endSigningOut()
    } else {
      resumeSync()
    }

    throw cause
  }
}
