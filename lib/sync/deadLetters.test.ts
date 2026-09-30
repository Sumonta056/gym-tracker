import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db, DEAD_STREAK_KEY, LOCAL_PROFILE_ID } from '../db/dexie'
import { dailyEntrySchema } from '../schema/dailyEntry'
import { exerciseSchema } from '../schema/exercise'
import { profileSchema } from '../schema/profile'

import {
  ACTIVE_SESSION_ELSEWHERE,
  deadLetterCount,
  discardDeadLetter,
  GLOBAL_ROW,
  isPermanent,
  readDeadStreak,
  writeDeadStreak,
  listDeadLetters,
  MAX_ATTEMPTS,
  moveToDeadLetters,
  PERMANENT_CODES,
  retryDeadLetter,
} from './deadLetters'
import { append, listPending, markDone } from './outbox'

import type { DailyEntry, Exercise, Profile, WorkoutSession, WorkoutSet } from '../db/dexie'

const ROW_A = '11111111-1111-4111-8111-111111111111'
const ROW_B = '22222222-2222-4222-8222-222222222222'
const FAILED_AT_ISO = '2026-09-01T10:05:00.000Z'
const FAILED_AT = Date.parse(FAILED_AT_ISO)

function row(id: string, overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    ...dailyEntrySchema.parse({ entry_date: '2026-09-01' }),
    id,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    ...profileSchema.parse({}),
    id: LOCAL_PROFILE_ID,
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

function exercise(id: string, name: string): Exercise {
  return {
    ...exerciseSchema.parse({ name, muscle_group: 'chest' }),
    id,
    user_id: LOCAL_PROFILE_ID,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
  }
}

function session(id: string, endedAt: string | null): WorkoutSession {
  return {
    id,
    entry_date: '2026-09-01',
    started_at: '2026-09-01T10:00:00.000Z',
    ended_at: endedAt,
    status: endedAt === null ? 'active' : 'finished',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
  }
}

function set(id: string, reps: number): WorkoutSet {
  return {
    id,
    session_id: ROW_B,
    exercise_id: ROW_A,
    set_index: 0,
    reps,
    weight_kg: 60,
    rpe: null,
    completed_at: null,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
  }
}

beforeEach(async () => {
  vi.restoreAllMocks()
  await db.open()
  await Promise.all([
    db.dailyEntries.clear(),
    db.profiles.clear(),
    db.outbox.clear(),
    db.deadLetters.clear(),
    db.syncMeta.clear(),
    db.exercises.clear(),
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
  ])
})

describe('PERMANENT_CODES', () => {
  const expected: [string, string][] = [
    ['42501', 'a Row Level Security rejection'],
    ['23502', 'a missing required column'],
    ['23503', 'an owner the server does not know'],
    ['23514', 'a failed check constraint'],
    ['22P02', 'a value of the wrong type'],
    ['22001', 'a text value that is too long'],
    ['22003', 'a number out of range'],
    ['22007', 'a date the server cannot read'],
    ['22008', 'a date out of range'],
    ['42703', 'a column the server does not have'],
    ['PGRST204', 'a column missing from the API schema cache'],
    [GLOBAL_ROW, 'a global seed row, which the server never takes from a device'],
    [ACTIVE_SESSION_ELSEWHERE, 'a second active session, which the server already holds'],
  ]

  it('names exactly the codes that can never succeed on a retry', () => {
    expect([...PERMANENT_CODES].sort()).toEqual(expected.map(([code]) => code).sort())
  })

  it.each(expected)('treats %s, %s, as permanent', (code) => {
    expect(isPermanent(code)).toBe(true)
  })
})

describe('isPermanent', () => {
  it.each([
    ['23505', 'a duplicate key, which the worker adopts'],
    ['PGRST301', 'an expired token, which a refresh fixes'],
    ['40001', 'a serialisation failure'],
    ['57014', 'a statement timeout'],
  ])('treats %s, %s, as transient', (code) => {
    expect(isPermanent(code)).toBe(false)
  })

  it('treats a failure with no code, such as a dropped network, as transient', () => {
    expect(isPermanent(null)).toBe(false)
  })
})

describe('the refusal count', () => {
  it('reads none when nothing is stored', async () => {
    expect(await readDeadStreak()).toBe(0)
  })

  it('reads back the count it wrote', async () => {
    await writeDeadStreak(2)

    expect(await readDeadStreak()).toBe(2)
    expect(await db.syncMeta.get(DEAD_STREAK_KEY)).toEqual({ key: DEAD_STREAK_KEY, value: '2' })
  })

  it.each(['not a number', '-1', '1.5'])('reads a stored %s as none', async (value) => {
    await db.syncMeta.put({ key: DEAD_STREAK_KEY, value })

    expect(await readDeadStreak()).toBe(0)
  })
})

describe('MAX_ATTEMPTS', () => {
  it('allows twenty attempts before an entry stops blocking the queue', () => {
    expect(MAX_ATTEMPTS).toBe(20)
  })
})

describe('moveToDeadLetters', () => {
  it('moves the entry out of the outbox with its code, its message and its attempt', async () => {
    const entry = await append('daily_entries', 'upsert', row(ROW_A))

    await moveToDeadLetters(entry.id, '42501', 'row level security', FAILED_AT)

    expect(await db.outbox.count()).toBe(0)
    expect(await db.deadLetters.get(entry.id)).toEqual({
      ...entry,
      attempts: 1,
      last_error: 'row level security',
      next_attempt_at: null,
      error_code: '42501',
      failed_at: '2026-09-01T10:05:00.000Z',
    })
  })

  it('moves the entry as it is stored now, not as the caller last read it', async () => {
    const entry = await append('daily_entries', 'upsert', row(ROW_A))
    await db.outbox.put({ ...entry, row_id: ROW_B, payload: row(ROW_B) })

    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)

    expect((await db.deadLetters.get(entry.id))?.row_id).toBe(ROW_B)
  })

  it('does nothing when the entry already left the outbox', async () => {
    await moveToDeadLetters('33333333-3333-4333-8333-333333333333', null, 'gone', FAILED_AT)

    expect(await db.deadLetters.count()).toBe(0)
  })

  it('keeps the entry in the outbox when the move fails half way, as one transaction', async () => {
    const entry = await append('daily_entries', 'upsert', row(ROW_A))
    vi.spyOn(db.deadLetters, 'put').mockImplementationOnce(() => {
      throw new Error('the disk is full')
    })

    await expect(moveToDeadLetters(entry.id, '42501', 'rls', FAILED_AT)).rejects.toThrow(
      'the disk is full',
    )

    expect(await db.outbox.get(entry.id)).toEqual(entry)
    expect(await db.deadLetters.count()).toBe(0)
  })
})

describe('listDeadLetters', () => {
  it('lists the dead letters in outbox order', async () => {
    const first = await append('daily_entries', 'upsert', row(ROW_A))
    const second = await append('daily_entries', 'upsert', row(ROW_B))
    await moveToDeadLetters(second.id, null, 'second', FAILED_AT)
    await moveToDeadLetters(first.id, null, 'first', FAILED_AT)

    expect((await listDeadLetters()).map((letter) => letter.id)).toEqual([first.id, second.id])
  })
})

describe('deadLetterCount', () => {
  it('counts the dead letters', async () => {
    const entry = await append('daily_entries', 'upsert', row(ROW_A))
    await append('daily_entries', 'upsert', row(ROW_B))
    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)

    expect(await deadLetterCount()).toBe(1)
  })
})

describe('retryDeadLetter', () => {
  it('puts the entry back in the outbox with its original id, row and sequence', async () => {
    await db.dailyEntries.put(row(ROW_A))
    const entry = await append('daily_entries', 'upsert', row(ROW_A))
    await moveToDeadLetters(entry.id, '42501', 'rls', FAILED_AT)

    await retryDeadLetter(entry.id)

    expect(await listPending()).toEqual([entry])
    expect(await db.deadLetters.count()).toBe(0)
  })

  it('never queues the row twice, so a retry cannot create a duplicate', async () => {
    await db.dailyEntries.put(row(ROW_A))
    const entry = await append('daily_entries', 'upsert', row(ROW_A))
    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)

    await retryDeadLetter(entry.id)
    await retryDeadLetter(entry.id)

    const queued = await listPending()
    expect(queued.map((item) => [item.id, item.row_id])).toEqual([[entry.id, ROW_A]])
  })

  it('sends the row as it stands now, so a later edit is never overwritten', async () => {
    const entry = await append('daily_entries', 'upsert', row(ROW_A, { steps: 100 }))
    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)
    const edited = row(ROW_A, { steps: 9000, updated_at: '2026-09-01T11:00:00.000Z' })
    await db.dailyEntries.put(edited)

    await retryDeadLetter(entry.id)

    expect((await listPending())[0]?.payload).toEqual(edited)
  })

  it('sends the profile as it stands now', async () => {
    const entry = await append('profiles', 'upsert', profile({ step_goal: 8000 }))
    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)
    const edited = profile({ step_goal: 11000 })
    await db.profiles.put(edited)

    await retryDeadLetter(entry.id)

    expect((await listPending())[0]?.payload).toEqual(edited)
  })

  it('sends the stored payload when the row is no longer on this device', async () => {
    const entry = await append('daily_entries', 'upsert', row(ROW_A, { steps: 100 }))
    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)

    await retryDeadLetter(entry.id)

    expect((await listPending())[0]?.payload).toEqual(row(ROW_A, { steps: 100 }))
  })

  it('sends the exercise as it stands now', async () => {
    const entry = await append('exercises', 'upsert', exercise(ROW_A, 'Bench'))
    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)
    const edited = exercise(ROW_A, 'Bench Press')
    await db.exercises.put(edited)

    await retryDeadLetter(entry.id)

    expect((await listPending())[0]?.payload).toEqual(edited)
  })

  it('sends the workout session as it stands now', async () => {
    const entry = await append('workout_sessions', 'upsert', session(ROW_A, null))
    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)
    const edited = session(ROW_A, '2026-09-01T11:00:00.000Z')
    await db.workoutSessions.put(edited)

    await retryDeadLetter(entry.id)

    expect((await listPending())[0]?.payload).toEqual(edited)
  })

  it('sends the workout set as it stands now', async () => {
    const entry = await append('workout_sets', 'upsert', set(ROW_A, 8))
    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)
    const edited = set(ROW_A, 10)
    await db.workoutSets.put(edited)

    await retryDeadLetter(entry.id)

    expect((await listPending())[0]?.payload).toEqual(edited)
  })

  it('never takes a daily entry that shares the id of a new-table row', async () => {
    const entry = await append('exercises', 'upsert', exercise(ROW_A, 'Bench'))
    await moveToDeadLetters(entry.id, null, 'gone', FAILED_AT)
    await db.dailyEntries.put(row(ROW_A))

    await retryDeadLetter(entry.id)

    expect((await listPending())[0]?.payload).toEqual(exercise(ROW_A, 'Bench'))
  })

  it('does nothing for an id that is not a dead letter', async () => {
    await retryDeadLetter('33333333-3333-4333-8333-333333333333')

    expect(await db.outbox.count()).toBe(0)
  })
})

describe('discardDeadLetter', () => {
  it('removes the entry and keeps the data of the local row', async () => {
    const local = row(ROW_A, { steps: 4321 })
    await db.dailyEntries.put(local)
    const entry = await append('daily_entries', 'upsert', local)
    await moveToDeadLetters(entry.id, '42501', 'rls', FAILED_AT)

    await discardDeadLetter(entry.id)

    expect(await db.deadLetters.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
    expect(await db.dailyEntries.get(ROW_A)).toEqual(local)
  })
})

describe('discardDeadLetter for a refused session', () => {
  const OTHER_SESSION = '44444444-4444-4444-8444-444444444444'
  const SET_1 = '55555555-5555-4555-8555-555555555555'
  const SET_2 = '66666666-6666-4666-8666-666666666666'
  const SET_3 = '77777777-7777-4777-8777-777777777777'

  async function refusedSession(): Promise<string> {
    const refused = session(ROW_B, null)
    await db.workoutSessions.put(refused)
    const entry = await append('workout_sessions', 'upsert', refused)
    await moveToDeadLetters(entry.id, ACTIVE_SESSION_ELSEWHERE, 'active elsewhere', FAILED_AT)

    return entry.id
  }

  async function discardedLocally(): Promise<void> {
    const stored = await db.workoutSessions.get(ROW_B)
    await db.workoutSessions.put({ ...session(ROW_B, null), ...stored, deleted_at: FAILED_AT_ISO })
  }

  async function queueSet(id: string, sessionId = ROW_B): Promise<WorkoutSet> {
    const local = { ...set(id, 8), session_id: sessionId }
    await db.workoutSets.put(local)
    await append('workout_sets', 'upsert', local)

    return local
  }

  function pendingRows(): Promise<string[]> {
    return listPending().then((entries) => entries.map((entry) => entry.row_id))
  }

  it('drops the held sets of a session discarded on this device, so they never fail again', async () => {
    const letter = await refusedSession()
    await queueSet(SET_1)
    await queueSet(SET_2)
    await discardedLocally()

    await discardDeadLetter(letter)

    expect(await db.deadLetters.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('drops them when the session is no longer on this device', async () => {
    const letter = await refusedSession()
    await queueSet(SET_1)
    await db.workoutSessions.delete(ROW_B)

    await discardDeadLetter(letter)

    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps the sets on this device', async () => {
    const letter = await refusedSession()
    const local = await queueSet(SET_1)
    await discardedLocally()

    await discardDeadLetter(letter)

    expect(await db.workoutSets.get(SET_1)).toEqual(local)
  })

  it('drops a queued delete of a set of the session too', async () => {
    const letter = await refusedSession()
    const local = await queueSet(SET_1)
    await append('workout_sets', 'delete', { ...local, deleted_at: FAILED_AT_ISO })
    await discardedLocally()

    await discardDeadLetter(letter)

    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps the queued sets of another session', async () => {
    const letter = await refusedSession()
    await queueSet(SET_1)
    await queueSet(SET_2, OTHER_SESSION)
    await discardedLocally()

    await discardDeadLetter(letter)

    expect(await pendingRows()).toEqual([SET_2])
  })

  it('keeps the held sets of a live session, which a later session write can still send', async () => {
    const letter = await refusedSession()
    await queueSet(SET_1)

    await discardDeadLetter(letter)
    const finish = await append('workout_sessions', 'upsert', session(ROW_B, FAILED_AT_ISO))
    await markDone(finish.id)

    expect(await pendingRows()).toEqual([SET_1])
  })

  it('keeps a set edit behind a refused update of a session the server already holds', async () => {
    const first = await append('workout_sessions', 'upsert', session(ROW_B, null))
    await markDone(first.id)
    await db.workoutSessions.put(session(ROW_B, FAILED_AT_ISO))
    const finish = await append('workout_sessions', 'upsert', session(ROW_B, FAILED_AT_ISO))
    await moveToDeadLetters(finish.id, null, 'timeout', FAILED_AT)
    await queueSet(SET_1)

    await discardDeadLetter(finish.id)

    expect(await pendingRows()).toEqual([SET_1])
  })

  it('keeps the held sets while another refusal of the same session remains', async () => {
    const first = await refusedSession()
    await queueSet(SET_1)
    const again = await append('workout_sessions', 'upsert', session(ROW_B, FAILED_AT_ISO))
    await moveToDeadLetters(again.id, ACTIVE_SESSION_ELSEWHERE, 'active elsewhere', FAILED_AT)
    await discardedLocally()

    await discardDeadLetter(first)

    expect(await pendingRows()).toEqual([SET_1])
    expect((await listDeadLetters()).map((letter) => letter.id)).toEqual([again.id])
  })

  it('keeps the held sets when a later write of the session still waits to be sent', async () => {
    const letter = await refusedSession()
    await queueSet(SET_1)
    await discardedLocally()
    await append('workout_sessions', 'delete', {
      ...session(ROW_B, null),
      deleted_at: FAILED_AT_ISO,
    })

    await discardDeadLetter(letter)

    expect(await pendingRows()).toEqual([SET_1, ROW_B])
  })

  it('keeps a refused set of the session in the failed list, with its own Retry and Discard', async () => {
    const letter = await refusedSession()
    await queueSet(SET_3)
    const [refusedSet] = await listPending()
    await moveToDeadLetters(refusedSet?.id ?? '', '23514', 'check', FAILED_AT)
    await discardedLocally()

    await discardDeadLetter(letter)

    expect((await listDeadLetters()).map((item) => item.row_id)).toEqual([SET_3])
  })

  it('leaves the queued sets alone when a refused set is discarded', async () => {
    await db.workoutSessions.put({ ...session(ROW_B, null), deleted_at: FAILED_AT_ISO })
    await queueSet(SET_1)
    const [refusedSet] = await listPending()
    await moveToDeadLetters(refusedSet?.id ?? '', '23514', 'check', FAILED_AT)
    await queueSet(SET_2)

    await discardDeadLetter(refusedSet?.id ?? '')

    expect(await pendingRows()).toEqual([SET_2])
  })

  it('does nothing for an id that is not a dead letter', async () => {
    await queueSet(SET_1)

    await discardDeadLetter('88888888-8888-4888-8888-888888888888')

    expect(await db.outbox.count()).toBe(1)
  })

  it('keeps the refusal and the held sets when the discard fails half way, as one transaction', async () => {
    const letter = await refusedSession()
    await queueSet(SET_1)
    await discardedLocally()
    vi.spyOn(db.deadLetters, 'delete').mockImplementationOnce(() => {
      throw new Error('the disk is full')
    })

    await expect(discardDeadLetter(letter)).rejects.toThrow('the disk is full')

    expect(await db.deadLetters.count()).toBe(1)
    expect(await pendingRows()).toEqual([SET_1])
  })
})
