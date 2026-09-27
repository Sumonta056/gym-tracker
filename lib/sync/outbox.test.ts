import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { db, OUTBOX_SEQUENCE_KEY } from '../db/dexie'
import { dailyEntrySchema } from '../schema/dailyEntry'

import {
  append,
  backoffMs,
  hasPending,
  isDue,
  lastSequence,
  listPending,
  nextPending,
  markDone,
  markFailed,
  pendingCount,
  syncedCount,
  SYNCED_TABLES,
} from './outbox'

import type { DailyEntry, OutboxEntry } from '../db/dexie'

const ROW_ID = '11111111-1111-4111-8111-111111111111'

function row(overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    ...dailyEntrySchema.parse({ entry_date: '2026-09-01' }),
    id: ROW_ID,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

async function stored(id: string): Promise<OutboxEntry> {
  const entry = await db.outbox.get(id)

  if (entry === undefined) {
    throw new Error(`the outbox entry ${id} is gone`)
  }

  return entry
}

beforeEach(async () => {
  await db.open()
  await Promise.all([db.outbox.clear(), db.syncMeta.clear()])
})

describe('append', () => {
  it('queues an entry that names the table, the operation and the row', async () => {
    const entry = await append('daily_entries', 'upsert', row())

    expect(entry).toMatchObject({
      sequence: 1,
      table_name: 'daily_entries',
      operation: 'upsert',
      row_id: ROW_ID,
      attempts: 0,
      last_error: null,
      next_attempt_at: null,
    })
    expect(await db.outbox.count()).toBe(1)
  })

  it('raises the sequence by one on every append', async () => {
    await append('daily_entries', 'upsert', row())
    const second = await append('daily_entries', 'delete', row())

    expect(second.sequence).toBe(2)
  })

  it('never reuses a sequence after the queue drains', async () => {
    const first = await append('daily_entries', 'upsert', row())
    await markDone(first.id)
    const second = await append('daily_entries', 'upsert', row())

    expect(second.sequence).toBe(2)
  })

  it('records the issued sequence so a reload cannot repeat it', async () => {
    await append('daily_entries', 'upsert', row())

    expect(await db.syncMeta.get(OUTBOX_SEQUENCE_KEY)).toEqual({
      key: OUTBOX_SEQUENCE_KEY,
      value: '1',
    })
  })

  it('ignores a damaged sequence marker and follows the queue instead', async () => {
    await db.syncMeta.put({ key: OUTBOX_SEQUENCE_KEY, value: 'not a number' })
    const entry = await append('daily_entries', 'upsert', row())

    expect(entry.sequence).toBe(1)
  })
})

describe('listPending', () => {
  it('returns an empty list when nothing is queued', async () => {
    expect(await listPending()).toEqual([])
  })

  it('returns every entry in sequence order', async () => {
    const first = await append('daily_entries', 'upsert', row())
    const second = await append('profiles', 'upsert', row())
    const third = await append('daily_entries', 'delete', row())

    expect((await listPending()).map((entry) => entry.id)).toEqual([first.id, second.id, third.id])
  })
})

describe('nextPending', () => {
  it('returns nothing when the queue is empty', async () => {
    expect(await nextPending()).toBeUndefined()
  })

  it('returns the lowest sequence, so the drain keeps the order', async () => {
    const first = await append('daily_entries', 'upsert', row())
    await append('daily_entries', 'delete', row())

    expect((await nextPending())?.id).toBe(first.id)
  })

  it('returns the next entry above the sequence it is given', async () => {
    const first = await append('daily_entries', 'upsert', row())
    const second = await append('daily_entries', 'delete', row())

    expect((await nextPending(first.sequence))?.id).toBe(second.id)
  })

  it('skips an entry for a table the worker does not sync yet', async () => {
    await append('exercises', 'upsert', row())
    const daily = await append('daily_entries', 'upsert', row())

    expect((await nextPending())?.id).toBe(daily.id)
  })

  it('returns nothing when only held entries are left', async () => {
    await append('workout_sessions', 'upsert', row())
    await append('workout_sets', 'upsert', row())

    expect(await nextPending()).toBeUndefined()
  })

  it('reads the entry again, so a re-keyed payload is never stale', async () => {
    const first = await append('daily_entries', 'upsert', row())
    await db.outbox.put({ ...first, row_id: 'moved' })

    expect((await nextPending())?.row_id).toBe('moved')
  })
})

describe('pendingCount', () => {
  it('counts every queued entry', async () => {
    await append('daily_entries', 'upsert', row())
    await append('daily_entries', 'delete', row())

    expect(await pendingCount()).toBe(2)
  })
})

describe('SYNCED_TABLES', () => {
  it('names the two tables the worker syncs today', () => {
    expect([...SYNCED_TABLES]).toEqual(['daily_entries', 'profiles'])
  })
})

describe('syncedCount', () => {
  it('counts only the entries of a table the worker syncs', async () => {
    await append('daily_entries', 'upsert', row())
    await append('exercises', 'upsert', row())
    await append('profiles', 'upsert', row())

    expect(await syncedCount()).toBe(2)
  })
})

describe('pendingCount with held entries', () => {
  it('counts a held entry, so the sign-out sheet still warns about it', async () => {
    await append('daily_entries', 'upsert', row())
    await append('exercises', 'upsert', row())

    expect(await pendingCount()).toBe(2)
  })
})

describe('hasPending', () => {
  it('reports true while a write for the row waits in the queue', async () => {
    await append('daily_entries', 'upsert', row())

    expect(await hasPending(ROW_ID)).toBe(true)
  })

  it('reports false for a row with nothing queued', async () => {
    await append('daily_entries', 'upsert', row())

    expect(await hasPending('22222222-2222-4222-8222-222222222222')).toBe(false)
  })
})

describe('markDone', () => {
  it('removes the entry from the queue', async () => {
    const entry = await append('daily_entries', 'upsert', row())
    await markDone(entry.id)

    expect(await db.outbox.count()).toBe(0)
  })
})

describe('markFailed', () => {
  it('keeps the entry and raises the attempt count by exactly one', async () => {
    const entry = await append('daily_entries', 'upsert', row())
    await markFailed(entry.id, 'network down', Date.parse('2026-09-01T10:00:00.000Z'))

    expect((await stored(entry.id)).attempts).toBe(1)
    expect((await stored(entry.id)).last_error).toBe('network down')
  })

  it('holds the entry back for the first back-off step', async () => {
    const entry = await append('daily_entries', 'upsert', row())
    await markFailed(entry.id, 'network down', Date.parse('2026-09-01T10:00:00.000Z'))

    expect((await stored(entry.id)).next_attempt_at).toBe('2026-09-01T10:00:01.000Z')
  })

  it('reaches the sixty second ceiling on the sixth failure', async () => {
    const entry = await append('daily_entries', 'upsert', row())
    const at = Date.parse('2026-09-01T10:00:00.000Z')

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await markFailed(entry.id, 'network down', at)
    }

    expect((await stored(entry.id)).attempts).toBe(6)
    expect((await stored(entry.id)).next_attempt_at).toBe('2026-09-01T10:01:00.000Z')
  })

  it('does nothing when the entry is already gone', async () => {
    await markFailed('missing', 'network down', Date.now())

    expect(await db.outbox.count()).toBe(0)
  })
})

describe('backoffMs', () => {
  it('follows 1, 2, 4, 8, 30, 60 seconds and then holds at 60', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(backoffMs)).toEqual([
      1000, 2000, 4000, 8000, 30000, 60000, 60000, 60000,
    ])
  })

  it('returns no delay before the first attempt', () => {
    expect(backoffMs(0)).toBe(0)
  })
})

describe('isDue', () => {
  it('treats a fresh entry as due', async () => {
    const entry = await append('daily_entries', 'upsert', row())

    expect(isDue(entry, Date.now())).toBe(true)
  })

  it('holds a failed entry back until its back-off passes', async () => {
    const entry = await append('daily_entries', 'upsert', row())
    const at = Date.parse('2026-09-01T10:00:00.000Z')
    await markFailed(entry.id, 'network down', at)
    const held = await stored(entry.id)

    expect(isDue(held, at + 999)).toBe(false)
    expect(isDue(held, at + 1000)).toBe(true)
  })
})

describe('lastSequence', () => {
  it('is 0 before any write was queued', async () => {
    expect(await lastSequence()).toBe(0)
  })

  it('names the last sequence issued, even once the queue drained', async () => {
    const first = await append('daily_entries', 'upsert', row())
    await append('daily_entries', 'upsert', row())
    await markDone(first.id)

    expect(await lastSequence()).toBe(2)
  })
})
