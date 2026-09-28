import { db, DEAD_STREAK_KEY } from '../db/dexie'

import type { DeadLetter, OutboxEntry, OutboxPayload } from '../db/dexie'

export const GLOBAL_ROW = 'GLOBAL_ROW'

export const ACTIVE_SESSION_ELSEWHERE = 'ACTIVE_SESSION_ELSEWHERE'

export const PERMANENT_CODES: readonly string[] = [
  '42501',
  '23502',
  '23503',
  '23514',
  '22P02',
  '22001',
  '22003',
  '22007',
  '22008',
  '42703',
  'PGRST204',
  GLOBAL_ROW,
  ACTIVE_SESSION_ELSEWHERE,
]

export const MAX_ATTEMPTS = 20

export const MAX_CONSECUTIVE_DEAD = 3

export function isPermanent(code: string | null): boolean {
  return code !== null && PERMANENT_CODES.includes(code)
}

export async function readDeadStreak(): Promise<number> {
  const stored = Number((await db.syncMeta.get(DEAD_STREAK_KEY))?.value ?? 0)

  return Number.isSafeInteger(stored) && stored > 0 ? stored : 0
}

export async function writeDeadStreak(streak: number): Promise<void> {
  await db.syncMeta.put({ key: DEAD_STREAK_KEY, value: String(streak) })
}

export async function moveToDeadLetters(
  id: string,
  code: string | null,
  message: string,
  nowMs: number,
): Promise<void> {
  await db.transaction('rw', db.outbox, db.deadLetters, async () => {
    const entry = await db.outbox.get(id)

    if (entry === undefined) {
      return
    }

    await db.deadLetters.put({
      ...entry,
      attempts: entry.attempts + 1,
      last_error: message,
      next_attempt_at: null,
      error_code: code,
      failed_at: new Date(nowMs).toISOString(),
    })
    await db.outbox.delete(id)
  })
}

export async function listDeadLetters(): Promise<DeadLetter[]> {
  return db.deadLetters.orderBy('sequence').toArray()
}

export async function deadLetterCount(): Promise<number> {
  return db.deadLetters.count()
}

async function currentRow(letter: DeadLetter): Promise<OutboxPayload | undefined> {
  switch (letter.table_name) {
    case 'profiles':
      return db.profiles.get(letter.row_id)
    case 'exercises':
      return db.exercises.get(letter.row_id)
    case 'workout_sessions':
      return db.workoutSessions.get(letter.row_id)
    case 'workout_sets':
      return db.workoutSets.get(letter.row_id)
    case 'daily_entries':
      return db.dailyEntries.get(letter.row_id)
  }
}

export async function retryDeadLetter(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.deadLetters,
      db.outbox,
      db.dailyEntries,
      db.profiles,
      db.exercises,
      db.workoutSessions,
      db.workoutSets,
    ],
    async () => {
      const letter = await db.deadLetters.get(id)

      if (letter === undefined) {
        return
      }

      const entry: OutboxEntry = {
        id: letter.id,
        sequence: letter.sequence,
        table_name: letter.table_name,
        operation: letter.operation,
        row_id: letter.row_id,
        payload: (await currentRow(letter)) ?? letter.payload,
        created_at: letter.created_at,
        attempts: 0,
        last_error: null,
        next_attempt_at: null,
      }

      await db.deadLetters.delete(id)
      await db.outbox.add(entry)
    },
  )
}

export async function discardDeadLetter(id: string): Promise<void> {
  await db.deadLetters.delete(id)
}
