import { db, OUTBOX_SEQUENCE_KEY } from '../db/dexie'
import { newId } from '../id'

import type {
  OutboxEntry,
  OutboxOperation,
  OutboxPayload,
  OutboxTableName,
  SyncMetaRecord,
  WorkoutSet,
} from '../db/dexie'

export const BACKOFF_CEILING_MS = 60000

export const SYNCED_TABLES: ReadonlySet<OutboxTableName> = new Set([
  'daily_entries',
  'profiles',
  'exercises',
  'workout_sessions',
  'workout_sets',
])

const PARENT_TABLES: ReadonlySet<OutboxTableName> = new Set(['exercises', 'workout_sessions'])

async function refusedParents(): Promise<ReadonlySet<string>> {
  const letters = await db.deadLetters
    .filter((letter) => PARENT_TABLES.has(letter.table_name))
    .toArray()

  return new Set(letters.map((letter) => letter.row_id))
}

function waitsOnParent(entry: OutboxEntry, refused: ReadonlySet<string>): boolean {
  if (entry.table_name !== 'workout_sets') {
    return false
  }

  const set = entry.payload as WorkoutSet

  return refused.has(set.session_id) || refused.has(set.exercise_id)
}

function sendable(refused: ReadonlySet<string>): (entry: OutboxEntry) => boolean {
  return (entry) => SYNCED_TABLES.has(entry.table_name) && !waitsOnParent(entry, refused)
}

function issuedSequence(marker: SyncMetaRecord | undefined): number {
  const issued = Number(marker?.value ?? 0)

  if (!Number.isSafeInteger(issued) || issued < 0) {
    return 0
  }

  return issued
}

export function backoffMs(attempts: number): number {
  if (attempts < 1) {
    return 0
  }

  if (attempts >= 6) {
    return BACKOFF_CEILING_MS
  }

  if (attempts === 5) {
    return 30000
  }

  return 1000 * 2 ** (attempts - 1)
}

export function isDue(entry: OutboxEntry, nowMs: number): boolean {
  if (entry.next_attempt_at === null) {
    return true
  }

  return Date.parse(entry.next_attempt_at) <= nowMs
}

export async function append(
  tableName: OutboxTableName,
  operation: OutboxOperation,
  payload: OutboxPayload,
): Promise<OutboxEntry> {
  const marker = await db.syncMeta.get(OUTBOX_SEQUENCE_KEY)
  const queued = await db.outbox.orderBy('sequence').last()
  const sequence = Math.max(issuedSequence(marker), queued?.sequence ?? 0) + 1

  await db.syncMeta.put({ key: OUTBOX_SEQUENCE_KEY, value: String(sequence) })

  const entry: OutboxEntry = {
    id: newId(),
    sequence,
    table_name: tableName,
    operation,
    row_id: payload.id,
    payload,
    created_at: new Date().toISOString(),
    attempts: 0,
    last_error: null,
    next_attempt_at: null,
  }

  await db.outbox.add(entry)

  return entry
}

export async function lastSequence(): Promise<number> {
  return issuedSequence(await db.syncMeta.get(OUTBOX_SEQUENCE_KEY))
}

export async function listPending(): Promise<OutboxEntry[]> {
  return db.outbox.orderBy('sequence').toArray()
}

export async function nextPending(after = 0): Promise<OutboxEntry | undefined> {
  const refused = await refusedParents()

  return db.outbox.where('sequence').above(after).filter(sendable(refused)).first()
}

export async function pendingCount(): Promise<number> {
  return db.outbox.count()
}

export async function syncedCount(): Promise<number> {
  const refused = await refusedParents()

  return db.outbox.filter(sendable(refused)).count()
}

export async function markDone(id: string): Promise<void> {
  await db.transaction('rw', db.outbox, db.deadLetters, async () => {
    const entry = await db.outbox.get(id)

    await db.outbox.delete(id)

    if (entry === undefined || !PARENT_TABLES.has(entry.table_name)) {
      return
    }

    await db.deadLetters
      .filter(
        (letter) =>
          letter.table_name === entry.table_name &&
          letter.row_id === entry.row_id &&
          letter.sequence < entry.sequence,
      )
      .delete()
  })
}

export async function markFailed(id: string, message: string, nowMs: number): Promise<void> {
  const entry = await db.outbox.get(id)

  if (entry === undefined) {
    return
  }

  const attempts = entry.attempts + 1

  await db.outbox.put({
    ...entry,
    attempts,
    last_error: message,
    next_attempt_at: new Date(nowMs + backoffMs(attempts)).toISOString(),
  })
}
