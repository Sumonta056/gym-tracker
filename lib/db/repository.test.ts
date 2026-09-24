import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dailyEntrySchema } from '../schema/dailyEntry'
import { moveToDeadLetters } from '../sync/deadLetters'
import { resumeSync, SIGN_OUT_MARKER } from '../sync/worker'

import { db } from './dexie'
import {
  clearAll,
  discardDeadLetter,
  outboxSequence,
  drainForSignOut,
  failedWrites,
  getDay,
  getProfile,
  listDeadLetters,
  listRange,
  LOCAL_PROFILE_ID,
  NEVER_WRITTEN,
  OUTBOX_SEQUENCE_KEY,
  pendingWrites,
  resumeSync as resumeFromRepository,
  retryDeadLetter,
  softDeleteDay,
  syncNow,
  updateProfile,
  UnsyncedWritesChanged,
  upsertDay,
} from './repository'

import type { DailyEntry } from './dexie'
import type { DailyEntryInput } from '../schema/dailyEntry'

vi.mock('../supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a unit test')
  },
}))

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> {
  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
    clear: () => {
      values.clear()
    },
  }
}

function entry(entryDate: string, overrides: Partial<DailyEntryInput> = {}): DailyEntryInput {
  return dailyEntrySchema.parse({ entry_date: entryDate, ...overrides })
}

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.stubGlobal('localStorage', memoryStorage())

  await db.open()
  await Promise.all([
    db.dailyEntries.clear(),
    db.profiles.clear(),
    db.outbox.clear(),
    db.deadLetters.clear(),
    db.syncMeta.clear(),
  ])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('upsertDay', () => {
  it('creates a row and exactly one outbox entry', async () => {
    const saved = await upsertDay(entry('2026-09-01', { steps: 8000 }))

    expect(await db.dailyEntries.count()).toBe(1)
    expect(await db.outbox.count()).toBe(1)
    expect(saved.steps).toBe(8000)
    expect(saved.deleted_at).toBeNull()
  })

  it('gives the new row a client generated uuid', async () => {
    const saved = await upsertDay(entry('2026-09-01'))

    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('appends an outbox entry that names the table, the operation and the row', async () => {
    const saved = await upsertDay(entry('2026-09-01', { steps: 8000 }))
    const queued = await db.outbox.toCollection().first()

    expect(queued).toMatchObject({
      sequence: 1,
      table_name: 'daily_entries',
      operation: 'upsert',
      row_id: saved.id,
      attempts: 0,
      last_error: null,
    })
    expect(queued?.payload).toEqual(saved)
  })

  it('updates the row on a second write to the same date without duplicating it', async () => {
    await upsertDay(entry('2026-09-01', { steps: 8000 }))
    const second = await upsertDay(entry('2026-09-01', { steps: 9000 }))

    expect(await db.dailyEntries.count()).toBe(1)
    expect(second.steps).toBe(9000)
  })

  it('appends a second outbox entry on the second write', async () => {
    await upsertDay(entry('2026-09-01', { steps: 8000 }))
    await upsertDay(entry('2026-09-01', { steps: 9000 }))

    const queued = await db.outbox.orderBy('sequence').toArray()

    expect(queued.map((item) => item.sequence)).toEqual([1, 2])
  })

  it('keeps the id of the row it updates', async () => {
    const first = await upsertDay(entry('2026-09-01', { steps: 8000 }))
    const second = await upsertDay(entry('2026-09-01', { steps: 9000 }))

    expect(second.id).toBe(first.id)
  })

  it('keeps the created_at of the row it updates', async () => {
    const first = await upsertDay(entry('2026-09-01'))
    const second = await upsertDay(entry('2026-09-01', { steps: 10 }))

    expect(second.created_at).toBe(first.created_at)
  })

  it('revives a soft deleted date under the same id', async () => {
    const first = await upsertDay(entry('2026-09-01'))
    await softDeleteDay('2026-09-01')
    const revived = await upsertDay(entry('2026-09-01', { steps: 500 }))

    expect(revived.id).toBe(first.id)
    expect(revived.deleted_at).toBeNull()
    expect(await db.dailyEntries.count()).toBe(1)
  })

  it('replaces the whole day, so a field the caller omits returns to its default', async () => {
    await upsertDay(entry('2026-09-01', { steps: 8000, weight_kg: 70, note: 'leg day' }))
    const second = await upsertDay(entry('2026-09-01', { steps: 9000 }))

    expect(second.steps).toBe(9000)
    expect(second.weight_kg).toBeNull()
    expect(second.note).toBeNull()
  })

  it('rejects input that fails the zod schema', async () => {
    const invalid = { ...entry('2026-09-01'), weight_kg: 999 }

    await expect(upsertDay(invalid)).rejects.toThrow()
  })

  it('rejects invalid input before it opens a transaction', async () => {
    const transaction = vi.spyOn(db, 'transaction')
    const invalid = { ...entry('2026-09-01'), steps: -1 }

    await expect(upsertDay(invalid)).rejects.toThrow()

    expect(transaction).not.toHaveBeenCalled()
    expect(await db.dailyEntries.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('rolls back the row and the outbox entry when the outbox append fails inside the transaction', async () => {
    await upsertDay(entry('2026-09-01', { steps: 8000 }))

    const entriesBefore = await db.dailyEntries.toArray()
    const outboxBefore = await db.outbox.toArray()

    const append = db.outbox.add.bind(db.outbox)
    let rowSeenInsideTransaction: DailyEntry | undefined
    let outboxCountInsideTransaction = 0

    vi.spyOn(db.outbox, 'add').mockImplementation((item) =>
      append(item).then(async () => {
        rowSeenInsideTransaction = await db.dailyEntries
          .where('entry_date')
          .equals('2026-09-01')
          .first()
        outboxCountInsideTransaction = await db.outbox.count()

        throw new Error('the outbox is full')
      }),
    )

    await expect(upsertDay(entry('2026-09-01', { steps: 9000 }))).rejects.toThrow(
      'the outbox is full',
    )

    vi.restoreAllMocks()

    expect(rowSeenInsideTransaction?.steps).toBe(9000)
    expect(outboxCountInsideTransaction).toBe(2)
    expect(await db.dailyEntries.toArray()).toEqual(entriesBefore)
    expect(await db.outbox.toArray()).toEqual(outboxBefore)
  })
})

describe('getDay', () => {
  it('returns the row saved for that date', async () => {
    const saved = await upsertDay(entry('2026-09-01', { steps: 8000 }))

    expect(await getDay('2026-09-01')).toEqual(saved)
  })

  it('returns undefined for a date with no row', async () => {
    expect(await getDay('2026-09-02')).toBeUndefined()
  })

  it('returns undefined for a soft deleted date', async () => {
    await upsertDay(entry('2026-09-01'))
    await softDeleteDay('2026-09-01')

    expect(await getDay('2026-09-01')).toBeUndefined()
  })
})

describe('listRange', () => {
  it('returns the rows of the range in date order', async () => {
    await upsertDay(entry('2026-09-03'))
    await upsertDay(entry('2026-09-01'))
    await upsertDay(entry('2026-09-02'))

    const rows = await listRange('2026-09-01', '2026-09-03')

    expect(rows.map((row) => row.entry_date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('includes both ends of the range and excludes what falls outside it', async () => {
    await upsertDay(entry('2026-08-31'))
    await upsertDay(entry('2026-09-01'))
    await upsertDay(entry('2026-09-02'))
    await upsertDay(entry('2026-09-03'))

    const rows = await listRange('2026-09-01', '2026-09-02')

    expect(rows.map((row) => row.entry_date)).toEqual(['2026-09-01', '2026-09-02'])
  })

  it('skips a row whose deleted_at is not null', async () => {
    await upsertDay(entry('2026-09-01'))
    await upsertDay(entry('2026-09-02'))
    await softDeleteDay('2026-09-01')

    const rows = await listRange('2026-09-01', '2026-09-02')

    expect(rows.map((row) => row.entry_date)).toEqual(['2026-09-02'])
  })

  it('returns an empty array for a range with no rows', async () => {
    expect(await listRange('2026-09-01', '2026-09-02')).toEqual([])
  })
})

describe('softDeleteDay', () => {
  it('sets deleted_at and keeps the row', async () => {
    await upsertDay(entry('2026-09-01'))
    await softDeleteDay('2026-09-01')

    const row = await db.dailyEntries.where('entry_date').equals('2026-09-01').first()

    expect(await db.dailyEntries.count()).toBe(1)
    expect(row?.deleted_at).not.toBeNull()
  })

  it('appends a delete outbox entry for the row', async () => {
    const saved = await upsertDay(entry('2026-09-01'))
    await softDeleteDay('2026-09-01')

    const queued = await db.outbox.orderBy('sequence').last()

    expect(await db.outbox.count()).toBe(2)
    expect(queued).toMatchObject({
      sequence: 2,
      table_name: 'daily_entries',
      operation: 'delete',
      row_id: saved.id,
    })
  })

  it('does nothing for a date with no row', async () => {
    await softDeleteDay('2026-09-01')

    expect(await db.dailyEntries.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('does not queue a second outbox entry for a date already deleted', async () => {
    await upsertDay(entry('2026-09-01'))
    await softDeleteDay('2026-09-01')
    await softDeleteDay('2026-09-01')

    expect(await db.outbox.count()).toBe(2)
  })
})

describe('getProfile', () => {
  it('returns the schema defaults when no profile row exists yet', async () => {
    const profile = await getProfile()

    expect(profile).toEqual({
      id: LOCAL_PROFILE_ID,
      updated_at: NEVER_WRITTEN,
      display_name: null,
      unit_system: 'metric',
      height_cm: null,
      target_weight_kg: null,
      step_goal: 12000,
    })
  })

  it('writes nothing when no profile row exists yet', async () => {
    await getProfile()

    expect(await db.profiles.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('returns the stored row once one exists', async () => {
    const saved = await updateProfile({ step_goal: 9000 })

    expect(await getProfile()).toEqual(saved)
  })
})

describe('updateProfile', () => {
  it('creates the profile row and one outbox entry', async () => {
    const saved = await updateProfile({ display_name: 'Sumonta' })

    expect(await db.profiles.count()).toBe(1)
    expect(await db.outbox.count()).toBe(1)
    expect(saved.display_name).toBe('Sumonta')
    expect(saved.id).toBe(LOCAL_PROFILE_ID)
  })

  it('appends an outbox entry that names the profiles table', async () => {
    const saved = await updateProfile({ unit_system: 'imperial' })
    const queued = await db.outbox.toCollection().first()

    expect(queued).toMatchObject({
      table_name: 'profiles',
      operation: 'upsert',
      row_id: LOCAL_PROFILE_ID,
    })
    expect(queued?.payload).toEqual(saved)
  })

  it('merges the patch onto the stored profile', async () => {
    await updateProfile({ display_name: 'Sumonta', step_goal: 9000 })
    const second = await updateProfile({ step_goal: 11000 })

    expect(second.display_name).toBe('Sumonta')
    expect(second.step_goal).toBe(11000)
    expect(await db.profiles.count()).toBe(1)
  })

  it('ignores an id and an updated_at carried in the patch', async () => {
    const saved = await updateProfile({ id: 'not-a-real-id', updated_at: NEVER_WRITTEN })

    expect(saved.id).toBe(LOCAL_PROFILE_ID)
    expect(saved.updated_at).not.toBe(NEVER_WRITTEN)
  })

  it('keeps a concurrent patch when two updates overlap', async () => {
    await Promise.all([
      updateProfile({ display_name: 'Sumonta' }),
      updateProfile({ step_goal: 9000 }),
    ])

    const profile = await getProfile()

    expect(profile.display_name).toBe('Sumonta')
    expect(profile.step_goal).toBe(9000)
  })

  it('keeps a stored field that the patch carries as undefined', async () => {
    await updateProfile({ display_name: 'Sumonta' })
    const second = await updateProfile({ display_name: undefined, step_goal: 9000 })

    expect(second.display_name).toBe('Sumonta')
    expect(second.step_goal).toBe(9000)
  })

  it('sets a stored field to null when the patch carries null', async () => {
    await updateProfile({ display_name: 'Sumonta' })
    const second = await updateProfile({ display_name: null })

    expect(second.display_name).toBeNull()
  })

  it('rejects a patch that fails the zod schema', async () => {
    await expect(updateProfile({ step_goal: 0 })).rejects.toThrow()

    expect(await db.profiles.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('the outbox sequence', () => {
  it('never reuses a number after the outbox is drained', async () => {
    await upsertDay(entry('2026-09-01'))
    await upsertDay(entry('2026-09-02'))
    await db.outbox.clear()
    await upsertDay(entry('2026-09-03'))

    const queued = await db.outbox.toCollection().first()

    expect(queued?.sequence).toBe(3)
  })

  it('records the highest number it has issued in the sync meta table', async () => {
    await upsertDay(entry('2026-09-01'))
    await upsertDay(entry('2026-09-02'))

    expect(await db.syncMeta.get(OUTBOX_SEQUENCE_KEY)).toEqual({
      key: OUTBOX_SEQUENCE_KEY,
      value: '2',
    })
  })

  it('stays ahead of the outbox when the marker is cleared with entries still queued', async () => {
    await upsertDay(entry('2026-09-01'))
    await db.syncMeta.clear()
    await upsertDay(entry('2026-09-02'))

    const queued = await db.outbox.orderBy('sequence').toArray()

    expect(queued.map((item) => item.sequence)).toEqual([1, 2])
  })

  it('stays ahead of the outbox when the marker is corrupt with entries still queued', async () => {
    await upsertDay(entry('2026-09-01'))
    await db.syncMeta.put({ key: OUTBOX_SEQUENCE_KEY, value: 'not a number' })
    await upsertDay(entry('2026-09-02'))

    const queued = await db.outbox.orderBy('sequence').toArray()

    expect(queued.map((item) => item.sequence)).toEqual([1, 2])
  })

  it('starts again at one when the stored marker is not a whole number', async () => {
    await db.syncMeta.put({ key: OUTBOX_SEQUENCE_KEY, value: 'not a number' })
    await upsertDay(entry('2026-09-01'))

    const queued = await db.outbox.toCollection().first()

    expect(queued?.sequence).toBe(1)
  })

  it('starts again at one when the stored marker is negative', async () => {
    await db.syncMeta.put({ key: OUTBOX_SEQUENCE_KEY, value: '-4' })
    await upsertDay(entry('2026-09-01'))

    const queued = await db.outbox.toCollection().first()

    expect(queued?.sequence).toBe(1)
  })
})

describe('a failure inside a write transaction', () => {
  function failTheOutbox(): void {
    const append = db.outbox.add.bind(db.outbox)

    vi.spyOn(db.outbox, 'add').mockImplementation((item) =>
      append(item).then(() => {
        throw new Error('the outbox is full')
      }),
    )
  }

  it('rolls back the soft delete and its outbox entry', async () => {
    await upsertDay(entry('2026-09-01'))

    const entriesBefore = await db.dailyEntries.toArray()
    const outboxBefore = await db.outbox.toArray()

    failTheOutbox()

    await expect(softDeleteDay('2026-09-01')).rejects.toThrow('the outbox is full')

    vi.restoreAllMocks()

    expect(await db.dailyEntries.toArray()).toEqual(entriesBefore)
    expect(await db.outbox.toArray()).toEqual(outboxBefore)
  })

  it('rolls back the profile write and its outbox entry', async () => {
    failTheOutbox()

    await expect(updateProfile({ step_goal: 9000 })).rejects.toThrow('the outbox is full')

    vi.restoreAllMocks()

    expect(await db.profiles.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('leaves no outbox entry behind when the row write itself fails', async () => {
    const put = db.dailyEntries.put.bind(db.dailyEntries)

    vi.spyOn(db.dailyEntries, 'put').mockImplementation((item) =>
      put(item).then(() => {
        throw new Error('the disk is full')
      }),
    )

    await expect(upsertDay(entry('2026-09-01'))).rejects.toThrow('the disk is full')

    vi.restoreAllMocks()

    expect(await db.dailyEntries.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('two live rows for one date', () => {
  const OLDER_ID = '11111111-1111-4111-8111-111111111111'
  const NEWER_ID = '22222222-2222-4222-8222-222222222222'

  function pulled(id: string, updatedAt: string, steps: number): DailyEntry {
    return {
      ...entry('2026-09-01', { steps }),
      id,
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: updatedAt,
      deleted_at: null,
    }
  }

  async function seedDuplicates(): Promise<void> {
    await db.dailyEntries.bulkPut([
      pulled(OLDER_ID, '2026-09-01T10:00:00.000Z', 1000),
      pulled(NEWER_ID, '2026-09-01T11:00:00.000Z', 2000),
    ])
  }

  it('returns only the newest of them from listRange', async () => {
    await seedDuplicates()

    const rows = await listRange('2026-09-01', '2026-09-01')

    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe(NEWER_ID)
  })

  it('returns the newest of them from getDay whichever order they are stored in', async () => {
    await db.dailyEntries.bulkPut([
      pulled(NEWER_ID, '2026-09-01T10:00:00.000Z', 1000),
      pulled(OLDER_ID, '2026-09-01T11:00:00.000Z', 2000),
    ])

    const row = await getDay('2026-09-01')

    expect(row?.id).toBe(OLDER_ID)
  })

  it('breaks a tie on the row id, so the answer never depends on storage order', async () => {
    await db.dailyEntries.bulkPut([
      pulled(NEWER_ID, '2026-09-01T10:00:00.000Z', 1000),
      pulled(OLDER_ID, '2026-09-01T10:00:00.000Z', 2000),
    ])

    const rows = await listRange('2026-09-01', '2026-09-01')

    expect(rows[0]?.id).toBe(OLDER_ID)
    expect((await getDay('2026-09-01'))?.id).toBe(OLDER_ID)
  })

  it('converges on one live row when the next write lands', async () => {
    await seedDuplicates()

    const saved = await upsertDay(entry('2026-09-01', { steps: 3000 }))
    const stored = await db.dailyEntries.where('entry_date').equals('2026-09-01').toArray()

    expect(saved.id).toBe(NEWER_ID)
    expect(stored.filter((row) => row.deleted_at === null)).toHaveLength(1)
    expect(stored).toHaveLength(2)
  })

  it('queues a delete for the duplicate it soft deletes', async () => {
    await seedDuplicates()

    await upsertDay(entry('2026-09-01', { steps: 3000 }))

    const queued = await db.outbox.orderBy('sequence').toArray()

    expect(queued.map((item) => [item.operation, item.row_id])).toEqual([
      ['delete', OLDER_ID],
      ['upsert', NEWER_ID],
    ])
  })

  it('converges on one live row when the date is soft deleted', async () => {
    await seedDuplicates()

    await softDeleteDay('2026-09-01')

    const stored = await db.dailyEntries.where('entry_date').equals('2026-09-01').toArray()

    expect(stored.filter((row) => row.deleted_at === null)).toHaveLength(0)
    expect(await getDay('2026-09-01')).toBeUndefined()
  })
})

describe('clearAll', () => {
  async function counted(): Promise<{ count: number; sequence: number }> {
    return {
      count: (await pendingWrites()) + (await failedWrites()),
      sequence: await outboxSequence(),
    }
  }

  function endSession(): Promise<string> {
    return Promise.resolve('signed out')
  }

  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
    globalThis.localStorage.clear()
  })

  it('ends the session after the clear and hands back its answer', async () => {
    await upsertDay(entry('2026-09-01', { steps: 4000 }))
    let rowsAtSignOut = -1

    const answer = await clearAll(await counted(), async () => {
      rowsAtSignOut = await db.dailyEntries.count()
      return 'signed out'
    })

    expect(answer).toBe('signed out')
    expect(rowsAtSignOut).toBe(0)
  })

  it('ends the session while it still holds the drain lock', async () => {
    const held: boolean[] = []
    let holding = false
    Object.defineProperty(globalThis.navigator, 'locks', {
      configurable: true,
      value: {
        request: async (_name: string, callback: () => Promise<unknown>) => {
          holding = true
          try {
            return await callback()
          } finally {
            holding = false
          }
        },
      },
    })

    await clearAll(await counted(), () => {
      held.push(holding)
      return Promise.resolve()
    })
    Reflect.deleteProperty(globalThis.navigator, 'locks')

    expect(held).toEqual([true])
  })

  it('refuses to clear a write that landed after the confirm count, and keeps it', async () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true })
    await drainForSignOut()
    expect(await pendingWrites()).toBe(0)
    const confirmed = await counted()
    await upsertDay(entry('2026-09-01', { steps: 4000 }))
    const signOut = vi.fn(endSession)

    const refused = await clearAll(confirmed, signOut).then(
      () => null,
      (cause: unknown) => cause,
    )

    expect(refused).toBeInstanceOf(UnsyncedWritesChanged)
    expect((refused as UnsyncedWritesChanged).count).toBe(1)
    expect(signOut).not.toHaveBeenCalled()
    expect(await db.dailyEntries.count()).toBe(1)
    expect(await db.outbox.count()).toBe(1)
  })

  it('refuses a write that landed after the confirm count even when the count stayed the same', async () => {
    await upsertDay(entry('2026-09-01', { steps: 4000 }))
    const confirmed = await counted()
    const [queued] = await db.outbox.toArray()
    await db.outbox.delete(queued?.id ?? '')
    await upsertDay(entry('2026-09-02', { steps: 5000 }))
    const signOut = vi.fn(endSession)

    const refused = await clearAll(confirmed, signOut).then(
      () => null,
      (cause: unknown) => cause,
    )

    expect(confirmed.count).toBe(1)
    expect(await pendingWrites()).toBe(1)
    expect(refused).toBeInstanceOf(UnsyncedWritesChanged)
    expect(refused).toMatchObject({ count: 1, sequence: confirmed.sequence + 1 })
    expect(signOut).not.toHaveBeenCalled()
    expect(await getDay('2026-09-02')).toMatchObject({ steps: 5000 })
    expect(await db.outbox.count()).toBe(1)
  })

  it('keeps this tab halted but lets the other tabs go when the count grew', async () => {
    await upsertDay(entry('2026-09-01', { steps: 4000 }))

    await expect(clearAll({ count: 0, sequence: 0 }, endSession)).rejects.toBeInstanceOf(
      UnsyncedWritesChanged,
    )

    expect(globalThis.localStorage.getItem(SIGN_OUT_MARKER)).toBeNull()
    expect(await syncNow()).toEqual({ status: 'offline', pushed: 0, pulled: 0, error: null })
  })

  it('counts the failed writes when it checks the confirm count', async () => {
    await upsertDay(entry('2026-09-01', { steps: 4000 }))
    const queued = await db.outbox.toArray()
    await moveToDeadLetters(queued[0]?.id ?? '', '42501', 'rls', Date.now())

    const sequence = await outboxSequence()

    await expect(clearAll({ count: 0, sequence }, endSession)).rejects.toBeInstanceOf(
      UnsyncedWritesChanged,
    )
    await expect(clearAll({ count: 1, sequence }, endSession)).resolves.toBe('signed out')
  })

  it('leaves the sign-out marker for the other tabs once the device is cleared', async () => {
    await clearAll(await counted(), endSession)

    expect(globalThis.localStorage.getItem(SIGN_OUT_MARKER)).not.toBeNull()
  })

  it('removes its sign-out marker when the clear fails', async () => {
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('locked'))

    await expect(clearAll(await counted(), endSession)).rejects.toThrow('locked')

    expect(globalThis.localStorage.getItem(SIGN_OUT_MARKER)).toBeNull()
  })

  afterEach(() => {
    resumeSync()
  })

  it('empties every table on the device', async () => {
    await upsertDay(entry('2026-09-01', { steps: 4000 }))
    await updateProfile({ step_goal: 9000 })
    await db.syncMeta.put({ key: 'pull_cursor_daily_entries', value: '2026-09-01T00:00:00.000Z' })
    const queued = await db.outbox.toArray()
    await moveToDeadLetters(queued[0]?.id ?? '', '42501', 'rls', Date.now())

    await clearAll(await counted(), endSession)

    expect(await db.dailyEntries.count()).toBe(0)
    expect(await db.profiles.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
    expect(await db.deadLetters.count()).toBe(0)
    expect(await db.syncMeta.count()).toBe(0)
  })

  it('halts the sync worker so it cannot write the old rows back', async () => {
    await clearAll(await counted(), endSession)

    expect(await syncNow()).toEqual({ status: 'offline', pushed: 0, pulled: 0, error: null })
  })

  it('lets the worker run again when the clear itself fails', async () => {
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('locked'))

    await expect(clearAll(await counted(), endSession)).rejects.toThrow('locked')

    expect(await syncNow()).toMatchObject({ status: 'error', error: 'no network in a unit test' })
  })

  it('re-exports resumeSync so a failed sign-out can restart the worker', async () => {
    await clearAll(await counted(), endSession)
    resumeFromRepository()

    expect(await syncNow()).toMatchObject({ status: 'error', error: 'no network in a unit test' })
  })

  it('reads the default profile once the device is cleared', async () => {
    await updateProfile({ step_goal: 9000 })

    await clearAll(await counted(), endSession)

    expect((await getProfile()).step_goal).toBe(12000)
  })
})

describe('pendingWrites', () => {
  it('counts the writes that wait in the outbox', async () => {
    await upsertDay(entry('2026-09-01', { steps: 4000 }))
    await updateProfile({ step_goal: 9000 })

    expect(await pendingWrites()).toBe(2)
  })
})

describe('the dead letters', () => {
  it('counts, lists, retries and discards the writes that failed for good', async () => {
    await upsertDay(entry('2026-09-01', { steps: 4000 }))
    await upsertDay(entry('2026-09-02', { steps: 5000 }))
    const [first, second] = await db.outbox.orderBy('sequence').toArray()
    await moveToDeadLetters(first?.id ?? '', '42501', 'rls', Date.now())
    await moveToDeadLetters(second?.id ?? '', '23514', 'check', Date.now())

    expect(await failedWrites()).toBe(2)
    expect((await listDeadLetters()).map((letter) => letter.error_code)).toEqual(['42501', '23514'])

    await retryDeadLetter(first?.id ?? '')
    await discardDeadLetter(second?.id ?? '')

    expect(await failedWrites()).toBe(0)
    expect(await pendingWrites()).toBe(1)
    expect((await getDay('2026-09-02'))?.steps).toBe(5000)
  })
})

describe('drainForSignOut', () => {
  afterEach(() => {
    resumeSync()
    globalThis.localStorage.clear()
  })

  it('halts the worker once the sign-out drain is done', async () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true })

    await drainForSignOut()

    expect(await syncNow()).toEqual({ status: 'offline', pushed: 0, pulled: 0, error: null })
  })
})
