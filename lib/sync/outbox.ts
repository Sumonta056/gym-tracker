import { db, OUTBOX_SEQUENCE_KEY } from '../db/dexie'
import { newId } from '../id'

import type {
  DailyEntry,
  OutboxEntry,
  OutboxOperation,
  OutboxTableName,
  Profile,
  SyncMetaRecord,
} from '../db/dexie'

export const BACKOFF_CEILING_MS = 60000

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
  payload: DailyEntry | Profile,
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

export async function listPending(): Promise<OutboxEntry[]> {
  return db.outbox.orderBy('sequence').toArray()
}

export async function nextPending(): Promise<OutboxEntry | undefined> {
  return db.outbox.orderBy('sequence').first()
}

export async function pendingCount(): Promise<number> {
  return db.outbox.count()
}

export async function hasPending(rowId: string): Promise<boolean> {
  const queued = await db.outbox.filter((entry) => entry.row_id === rowId).first()

  return queued !== undefined
}

export async function markDone(id: string): Promise<void> {
  await db.outbox.delete(id)
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
