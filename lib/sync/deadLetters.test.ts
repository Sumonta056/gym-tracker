import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db, LOCAL_PROFILE_ID } from '../db/dexie'
import { dailyEntrySchema } from '../schema/dailyEntry'
import { profileSchema } from '../schema/profile'

import {
  deadLetterCount,
  discardDeadLetter,
  isPermanent,
  listDeadLetters,
  MAX_ATTEMPTS,
  moveToDeadLetters,
  PERMANENT_CODES,
  retryDeadLetter,
} from './deadLetters'
import { append, listPending } from './outbox'

import type { DailyEntry, Profile } from '../db/dexie'

const ROW_A = '11111111-1111-4111-8111-111111111111'
const ROW_B = '22222222-2222-4222-8222-222222222222'
const FAILED_AT = Date.parse('2026-09-01T10:05:00.000Z')

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

beforeEach(async () => {
  vi.restoreAllMocks()
  await db.open()
  await Promise.all([
    db.dailyEntries.clear(),
    db.profiles.clear(),
    db.outbox.clear(),
    db.deadLetters.clear(),
    db.syncMeta.clear(),
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
