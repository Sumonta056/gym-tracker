import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DAILY_CURSOR_KEY, db, PROFILE_CURSOR_KEY } from '../db/dexie'
import { LOCAL_PROFILE_ID } from '../db/repository'
import { dailyEntrySchema } from '../schema/dailyEntry'
import { profileSchema } from '../schema/profile'

import { append, listPending } from './outbox'
import {
  DUPLICATE_KEY,
  getSyncState,
  pull,
  push,
  startSync,
  subscribeSyncState,
  SYNC_INTERVAL_MS,
  sync,
} from './worker'

import type { SyncState } from './worker'
import type { DailyEntry, Profile } from '../db/dexie'
import type { Database } from '../supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

const USER_ID = '99999999-9999-4999-8999-999999999999'
const ROW_A = '11111111-1111-4111-8111-111111111111'
const ROW_B = '22222222-2222-4222-8222-222222222222'
const SERVER_STAMP = '2026-09-01T11:00:00.000Z'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('../supabase/client', () => ({
  createClient: mocks.createClient,
}))

interface Failure {
  message: string
  code?: string
}

interface Upserted {
  table: string
  row: Record<string, unknown>
  onConflict: string
}

interface Selected {
  table: string
  cursor: string
}

interface FakeOptions {
  user?: string | null
  getUserThrows?: boolean
  serverRows?: Record<string, Record<string, unknown>[]>
  serverStamp?: string
  upsertError?: Record<string, Failure>
  upsertErrorAlways?: boolean
  onUpsert?: () => Promise<void>
  upsertThrows?: string[]
  silentUpsert?: string[]
  selectError?: Record<string, string>
  selectThrows?: string[]
  liveRowId?: string
  lookupError?: string
}

interface Fake {
  client: SupabaseClient<Database>
  upserted: Upserted[]
  selected: Selected[]
}

function fakeClient(options: FakeOptions = {}): Fake {
  const upserted: Upserted[] = []
  const selected: Selected[] = []
  const user = options.user === undefined ? USER_ID : options.user
  let attempt = 0

  async function upsertAnswer(table: string): Promise<unknown> {
    if (options.upsertThrows?.includes(table) === true) {
      throw new Error('the fetch was aborted')
    }

    await options.onUpsert?.()

    attempt += 1
    const failure = options.upsertError?.[table]

    if (failure !== undefined && (attempt === 1 || options.upsertErrorAlways === true)) {
      return { data: null, error: failure }
    }

    if (options.silentUpsert?.includes(table) === true) {
      return { data: null, error: null }
    }

    return { data: { updated_at: options.serverStamp ?? SERVER_STAMP }, error: null }
  }

  function listAnswer(table: string): Promise<unknown> {
    if (options.selectThrows?.includes(table) === true) {
      return Promise.reject(new Error('the fetch was aborted'))
    }

    const failure = options.selectError?.[table]

    if (failure !== undefined) {
      return Promise.resolve({ data: null, error: { message: failure } })
    }

    return Promise.resolve({ data: options.serverRows?.[table] ?? [], error: null })
  }

  function lookupAnswer(): Promise<unknown> {
    if (options.lookupError !== undefined) {
      return Promise.resolve({ data: null, error: { message: options.lookupError } })
    }

    return Promise.resolve({
      data: options.liveRowId === undefined ? null : { id: options.liveRowId },
      error: null,
    })
  }

  const client = {
    auth: {
      getUser: () => {
        if (options.getUserThrows === true) {
          return Promise.reject(new Error('the session could not be read'))
        }

        return Promise.resolve({ data: { user: user === null ? null : { id: user } } })
      },
    },
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>, config: { onConflict: string }) => {
        upserted.push({ table, row, onConflict: config.onConflict })

        return {
          select: () => ({
            maybeSingle: () => upsertAnswer(table),
          }),
        }
      },
      select: () => ({
        gt: (_column: string, cursor: string) => ({
          order: () => {
            selected.push({ table, cursor })

            return listAnswer(table)
          },
        }),
        eq: () => ({
          is: () => ({
            maybeSingle: () => lookupAnswer(),
          }),
        }),
      }),
    }),
  }

  return { client: client as unknown as SupabaseClient<Database>, upserted, selected }
}

function firstUpsert(fake: Fake): Upserted {
  const call = fake.upserted[0]

  if (call === undefined) {
    throw new Error('no upsert was recorded')
  }

  return call
}

function firstSelect(fake: Fake): Selected {
  const call = fake.selected[0]

  if (call === undefined) {
    throw new Error('no select was recorded')
  }

  return call
}

function localEntry(id: string, overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    ...dailyEntrySchema.parse({ entry_date: '2026-09-01' }),
    id,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function serverEntry(id: string, updatedAt: string, steps: number): Record<string, unknown> {
  return {
    ...localEntry(id, { updated_at: updatedAt, steps }),
    user_id: USER_ID,
  }
}

function serverProfile(updatedAt: string, unitSystem = 'metric'): Record<string, unknown> {
  return {
    id: USER_ID,
    display_name: 'Sam',
    unit_system: unitSystem,
    height_cm: 180,
    target_weight_kg: 75,
    step_goal: 9000,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: updatedAt,
  }
}

function localProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    ...profileSchema.parse({}),
    id: LOCAL_PROFILE_ID,
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

async function cursor(key: string): Promise<string | null | undefined> {
  return (await db.syncMeta.get(key))?.value
}

beforeEach(async () => {
  mocks.createClient.mockReset()
  await db.open()
  await Promise.all([
    db.dailyEntries.clear(),
    db.profiles.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
  ])
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('push', () => {
  it('drains every pending entry in outbox order and clears the outbox', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    await append('daily_entries', 'upsert', localEntry(ROW_B))
    const fake = fakeClient()

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result).toEqual({ pushed: 2, error: null })
    expect(fake.upserted.map((call) => call.row.id)).toEqual([ROW_A, ROW_B])
    expect(await db.outbox.count()).toBe(0)
  })

  it('fills the owner column from the session', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect(firstUpsert(fake).row.user_id).toBe(USER_ID)
  })

  it('never sends the device clock in updated_at, so the server owns that column', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    await append('profiles', 'upsert', localProfile())
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect(fake.upserted.every((call) => !('updated_at' in call.row))).toBe(true)
  })

  it('maps the local profile id to the session user id', async () => {
    await append('profiles', 'upsert', localProfile())
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect(firstUpsert(fake)).toMatchObject({ table: 'profiles', onConflict: 'id' })
    expect(firstUpsert(fake).row.id).toBe(USER_ID)
  })

  it('upserts on the client uuid so the same row never lands twice', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 9000 }))
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect(fake.upserted).toHaveLength(2)
    expect(new Set(fake.upserted.map((call) => call.row.id))).toEqual(new Set([ROW_A]))
    expect(fake.upserted.every((call) => call.onConflict === 'id')).toBe(true)
  })

  it('sends a soft delete as an upsert that carries deleted_at', async () => {
    await append(
      'daily_entries',
      'delete',
      localEntry(ROW_A, { deleted_at: '2026-09-02T10:00:00.000Z' }),
    )
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect(firstUpsert(fake).row.deleted_at).toBe('2026-09-02T10:00:00.000Z')
  })

  it('keeps a failed entry and raises its attempt count by exactly one', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({ upsertError: { daily_entries: { message: 'network down' } } })

    const result = await push(fake.client, USER_ID, Date.parse('2026-09-01T10:00:00.000Z'))

    expect(result).toEqual({ pushed: 0, error: 'network down' })
    expect(await db.outbox.get(entry.id)).toMatchObject({
      attempts: 1,
      last_error: 'network down',
      next_attempt_at: '2026-09-01T10:00:01.000Z',
    })
  })

  it('keeps the entry and records the failure when the request throws', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({ upsertThrows: ['daily_entries'] })

    const result = await push(fake.client, USER_ID, Date.parse('2026-09-01T10:00:00.000Z'))

    expect(result).toEqual({ pushed: 0, error: 'the fetch was aborted' })
    expect(await db.outbox.get(entry.id)).toMatchObject({
      attempts: 1,
      last_error: 'the fetch was aborted',
    })
  })

  it('stops the drain at the first failure so a later write never jumps the queue', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    await append('daily_entries', 'upsert', localEntry(ROW_B))
    const fake = fakeClient({ upsertThrows: ['daily_entries'] })

    await push(fake.client, USER_ID, Date.now())

    expect(fake.upserted).toHaveLength(1)
    expect(await db.outbox.count()).toBe(2)
  })

  it('never drains past the queue length it started with', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({
      onUpsert: async () => {
        await append('daily_entries', 'upsert', localEntry(ROW_B))
      },
    })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result).toEqual({ pushed: 1, error: null })
    expect(fake.upserted).toHaveLength(1)
    expect(await db.outbox.count()).toBe(1)
  })

  it('holds a failed entry back until its back-off passes', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const at = Date.parse('2026-09-01T10:00:00.000Z')
    const failing = fakeClient({ upsertThrows: ['daily_entries'] })
    await push(failing.client, USER_ID, at)

    const waiting = fakeClient()
    const held = await push(waiting.client, USER_ID, at + 500)
    expect(waiting.upserted).toHaveLength(0)
    expect(held).toEqual({ pushed: 0, error: null })

    const due = fakeClient()
    await push(due.client, USER_ID, at + 1000)
    expect(due.upserted).toHaveLength(1)
  })
})

describe('the server timestamp write back', () => {
  it('stores the server updated_at on the local row after a successful push', async () => {
    await db.dailyEntries.put(localEntry(ROW_A))
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect((await db.dailyEntries.get(ROW_A))?.updated_at).toBe(SERVER_STAMP)
  })

  it('stores the server updated_at on the local profile after a successful push', async () => {
    await db.profiles.put(localProfile())
    await append('profiles', 'upsert', localProfile())
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect((await db.profiles.get(LOCAL_PROFILE_ID))?.updated_at).toBe(SERVER_STAMP)
  })

  it('leaves a row that changed while the push was in flight', async () => {
    await db.dailyEntries.put(localEntry(ROW_A, { updated_at: '2026-09-01T10:30:00.000Z' }))
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect((await db.dailyEntries.get(ROW_A))?.updated_at).toBe('2026-09-01T10:30:00.000Z')
  })

  it('leaves a profile that changed while the push was in flight', async () => {
    await db.profiles.put(localProfile({ updated_at: '2026-09-01T10:30:00.000Z' }))
    await append('profiles', 'upsert', localProfile())
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect((await db.profiles.get(LOCAL_PROFILE_ID))?.updated_at).toBe('2026-09-01T10:30:00.000Z')
  })

  it('leaves the local timestamps alone when the server returns no row', async () => {
    await db.dailyEntries.put(localEntry(ROW_A))
    await db.profiles.put(localProfile())
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    await append('profiles', 'upsert', localProfile())
    const fake = fakeClient({ silentUpsert: ['daily_entries', 'profiles'] })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result).toEqual({ pushed: 2, error: null })
    expect((await db.dailyEntries.get(ROW_A))?.updated_at).toBe('2026-09-01T10:00:00.000Z')
    expect((await db.profiles.get(LOCAL_PROFILE_ID))?.updated_at).toBe('2026-09-01T10:00:00.000Z')
  })

  it('writes nothing back when the row is not in Dexie', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    await append('profiles', 'upsert', localProfile())
    const fake = fakeClient()

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result).toEqual({ pushed: 2, error: null })
    expect(await db.dailyEntries.count()).toBe(0)
    expect(await db.profiles.count()).toBe(0)
  })
})

describe('a duplicate date on the server', () => {
  const duplicate = { message: 'duplicate key value', code: DUPLICATE_KEY }

  it('adopts the server row id and pushes the write again', async () => {
    await db.dailyEntries.put(localEntry(ROW_A, { steps: 7000 }))
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 7000 }))
    const fake = fakeClient({ upsertError: { daily_entries: duplicate }, liveRowId: ROW_B })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result).toEqual({ pushed: 1, error: null })
    expect(fake.upserted.map((call) => call.row.id)).toEqual([ROW_A, ROW_B])
    expect(await db.outbox.count()).toBe(0)
  })

  it('moves the local row onto the server id and keeps the write', async () => {
    await db.dailyEntries.put(localEntry(ROW_A, { steps: 7000 }))
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 7000 }))
    const fake = fakeClient({ upsertError: { daily_entries: duplicate }, liveRowId: ROW_B })

    await push(fake.client, USER_ID, Date.now())

    expect(await db.dailyEntries.get(ROW_A)).toBeUndefined()
    expect(await db.dailyEntries.get(ROW_B)).toMatchObject({ id: ROW_B, steps: 7000 })
  })

  it('moves every queued write for that row onto the server id', async () => {
    await db.dailyEntries.put(localEntry(ROW_A, { steps: 7000 }))
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 7000 }))
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 8000 }))
    const fake = fakeClient({ upsertError: { daily_entries: duplicate }, liveRowId: ROW_B })

    await push(fake.client, USER_ID, Date.now())

    expect(fake.upserted.map((call) => call.row.id)).toEqual([ROW_A, ROW_B, ROW_B])
    expect(fake.upserted.map((call) => call.row.steps)).toEqual([7000, 7000, 8000])
  })

  it('reports the failure when the server holds no live row for that date', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({ upsertError: { daily_entries: duplicate } })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result.error).toBe('the server holds another live row for 2026-09-01')
    expect(await db.outbox.get(entry.id)).toBeDefined()
  })

  it('reports the failure when the server row carries the same id', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({ upsertError: { daily_entries: duplicate }, liveRowId: ROW_A })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result.error).toBe('the server holds another live row for 2026-09-01')
  })

  it('reports the failure when the lookup itself fails', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({
      upsertError: { daily_entries: duplicate },
      lookupError: 'the lookup failed',
    })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result.error).toBe('the lookup failed')
  })

  it('never adopts a second time, so a duplicate cannot loop', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({
      upsertError: { daily_entries: duplicate },
      upsertErrorAlways: true,
      liveRowId: ROW_B,
    })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(fake.upserted.map((call) => call.row.id)).toEqual([ROW_A, ROW_B])
    expect(result.error).toBe('duplicate key value')
    expect(await db.outbox.get(entry.id)).toMatchObject({ attempts: 1 })
  })

  it('never adopts on the profiles table, which has no date collision', async () => {
    await append('profiles', 'upsert', localProfile())
    const fake = fakeClient({ upsertError: { profiles: duplicate }, upsertErrorAlways: true })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result.error).toBe('duplicate key value')
    expect(fake.upserted).toHaveLength(1)
  })

  it('keeps the newer row that already sits under the server id', async () => {
    await db.dailyEntries.put(localEntry(ROW_A, { steps: 7000 }))
    await db.dailyEntries.put(
      localEntry(ROW_B, { steps: 3000, updated_at: '2026-09-01T20:00:00.000Z' }),
    )
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 7000 }))
    const fake = fakeClient({ upsertError: { daily_entries: duplicate }, liveRowId: ROW_B })

    await push(fake.client, USER_ID, Date.now())

    expect(await db.dailyEntries.get(ROW_A)).toBeUndefined()
    expect((await db.dailyEntries.get(ROW_B))?.steps).toBe(3000)
    expect(fake.upserted.map((call) => call.row.steps)).toEqual([7000, 3000])
  })

  it('lands a later queued write over the holder, as any later write does', async () => {
    await db.dailyEntries.put(localEntry(ROW_A, { steps: 7000 }))
    await db.dailyEntries.put(
      localEntry(ROW_B, { steps: 3000, updated_at: '2026-09-01T20:00:00.000Z' }),
    )
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 7000 }))
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 8000 }))
    const fake = fakeClient({ upsertError: { daily_entries: duplicate }, liveRowId: ROW_B })

    await push(fake.client, USER_ID, Date.now())

    expect(fake.upserted.map((call) => call.row.steps)).toEqual([7000, 3000, 8000])
    expect((await db.dailyEntries.get(ROW_B))?.steps).toBe(3000)
  })

  it('takes over the server id when the local write is the newer one', async () => {
    await db.dailyEntries.put(
      localEntry(ROW_A, { steps: 7000, updated_at: '2026-09-01T20:00:00.000Z' }),
    )
    await db.dailyEntries.put(localEntry(ROW_B, { steps: 3000 }))
    await append(
      'daily_entries',
      'upsert',
      localEntry(ROW_A, { steps: 7000, updated_at: '2026-09-01T20:00:00.000Z' }),
    )
    const fake = fakeClient({ upsertError: { daily_entries: duplicate }, liveRowId: ROW_B })

    await push(fake.client, USER_ID, Date.now())

    expect((await db.dailyEntries.get(ROW_B))?.steps).toBe(7000)
    expect(fake.upserted.map((call) => call.row.steps)).toEqual([7000, 7000])
  })
})

describe('pull', () => {
  it('writes a newer server row over the local row', async () => {
    await db.dailyEntries.put(localEntry(ROW_A, { steps: 1000 }))
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_A, '2026-09-01T12:00:00.000Z', 5000)] },
    })

    const result = await pull(fake.client)

    expect(result).toEqual({ pulled: 1, error: null })
    expect((await db.dailyEntries.get(ROW_A))?.steps).toBe(5000)
  })

  it('never stores the owner column in the local row', async () => {
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_A, '2026-09-01T12:00:00.000Z', 5000)] },
    })

    await pull(fake.client)

    expect(await db.dailyEntries.get(ROW_A)).not.toHaveProperty('user_id')
  })

  it('keeps a newer local row when the server row is older', async () => {
    await db.dailyEntries.put(
      localEntry(ROW_A, { steps: 1000, updated_at: '2026-09-01T14:00:00.000Z' }),
    )
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_A, '2026-09-01T12:00:00.000Z', 5000)] },
    })

    await pull(fake.client)

    expect((await db.dailyEntries.get(ROW_A))?.steps).toBe(1000)
  })

  it('lets the server win on an equal updated_at', async () => {
    await db.dailyEntries.put(
      localEntry(ROW_A, { steps: 1000, updated_at: '2026-09-01T12:00:00.000Z' }),
    )
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_A, '2026-09-01T12:00:00.000Z', 5000)] },
    })

    await pull(fake.client)

    expect((await db.dailyEntries.get(ROW_A))?.steps).toBe(5000)
  })

  it('never overwrites a row whose write still waits in the outbox', async () => {
    await db.dailyEntries.put(localEntry(ROW_A, { steps: 1000 }))
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 1000 }))
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_A, '2026-09-09T12:00:00.000Z', 5000)] },
    })

    await pull(fake.client)

    expect((await db.dailyEntries.get(ROW_A))?.steps).toBe(1000)
  })

  it('maps the server profile id back to the local sentinel', async () => {
    const fake = fakeClient({
      serverRows: { profiles: [serverProfile('2026-09-01T12:00:00.000Z', 'imperial')] },
    })

    await pull(fake.client)
    const stored = await db.profiles.get(LOCAL_PROFILE_ID)

    expect(stored).toMatchObject({
      id: LOCAL_PROFILE_ID,
      display_name: 'Sam',
      unit_system: 'imperial',
      step_goal: 9000,
    })
    expect(stored).not.toHaveProperty('created_at')
  })

  it('falls back to metric when the server unit system is not a known value', async () => {
    const fake = fakeClient({
      serverRows: { profiles: [serverProfile('2026-09-01T12:00:00.000Z', 'furlongs')] },
    })

    await pull(fake.client)

    expect((await db.profiles.get(LOCAL_PROFILE_ID))?.unit_system).toBe('metric')
  })

  it('keeps a newer local profile when the server profile is older', async () => {
    await db.profiles.put(localProfile({ updated_at: '2026-09-01T14:00:00.000Z' }))
    const fake = fakeClient({
      serverRows: { profiles: [serverProfile('2026-09-01T12:00:00.000Z')] },
    })

    const result = await pull(fake.client)

    expect(result.pulled).toBe(0)
    expect((await db.profiles.get(LOCAL_PROFILE_ID))?.display_name).toBeNull()
  })

  it('moves the cursor to the highest updated_at it saw', async () => {
    const fake = fakeClient({
      serverRows: {
        daily_entries: [
          serverEntry(ROW_A, '2026-09-01T12:00:00.000Z', 1000),
          serverEntry(ROW_B, '2026-09-01T13:00:00.000Z', 2000),
        ],
      },
    })

    await pull(fake.client)

    expect(await cursor(DAILY_CURSOR_KEY)).toBe('2026-09-01T13:00:00.000Z')
  })

  it('never moves the cursor past a row it refused', async () => {
    await db.dailyEntries.put(
      localEntry(ROW_A, { steps: 1000, updated_at: '2026-09-01T23:00:00.000Z' }),
    )
    const fake = fakeClient({
      serverRows: {
        daily_entries: [
          serverEntry(ROW_A, '2026-09-01T12:00:00.000Z', 5000),
          serverEntry(ROW_B, '2026-09-01T13:00:00.000Z', 2000),
        ],
      },
    })

    await pull(fake.client)

    expect(await cursor(DAILY_CURSOR_KEY)).toBeUndefined()
    expect((await db.dailyEntries.get(ROW_B))?.steps).toBe(2000)
  })

  it('never moves the profile cursor past a profile it refused', async () => {
    await db.profiles.put(localProfile({ updated_at: '2026-09-01T23:00:00.000Z' }))
    const fake = fakeClient({
      serverRows: { profiles: [serverProfile('2026-09-01T12:00:00.000Z')] },
    })

    await pull(fake.client)

    expect(await cursor(PROFILE_CURSOR_KEY)).toBeUndefined()
  })

  it('starts from the epoch when no cursor is stored', async () => {
    const fake = fakeClient()

    await pull(fake.client)

    expect(fake.selected.map((call) => call.cursor)).toEqual([
      '1970-01-01T00:00:00.000Z',
      '1970-01-01T00:00:00.000Z',
    ])
  })

  it('reads from the stored cursor on the next pull', async () => {
    await db.syncMeta.put({ key: DAILY_CURSOR_KEY, value: '2026-09-01T13:00:00.000Z' })
    const fake = fakeClient()

    await pull(fake.client)

    expect(firstSelect(fake).cursor).toBe('2026-09-01T13:00:00.000Z')
  })

  it('leaves the cursor where it was when the pull fails', async () => {
    await db.syncMeta.put({ key: DAILY_CURSOR_KEY, value: '2026-09-01T13:00:00.000Z' })
    const fake = fakeClient({ selectError: { daily_entries: 'network down' } })

    const result = await pull(fake.client)

    expect(result).toEqual({ pulled: 0, error: 'network down' })
    expect(await cursor(DAILY_CURSOR_KEY)).toBe('2026-09-01T13:00:00.000Z')
  })

  it('never moves the cursor backward', async () => {
    await db.syncMeta.put({ key: DAILY_CURSOR_KEY, value: '2026-09-05T13:00:00.000Z' })
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_A, '2026-09-01T12:00:00.000Z', 1000)] },
    })

    await pull(fake.client)

    expect(await cursor(DAILY_CURSOR_KEY)).toBe('2026-09-05T13:00:00.000Z')
  })

  it('reports a failed profile pull after the entries already landed', async () => {
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_A, '2026-09-01T12:00:00.000Z', 1000)] },
      selectError: { profiles: 'profile gone' },
    })

    const result = await pull(fake.client)

    expect(result).toEqual({ pulled: 1, error: 'profile gone' })
    expect(await db.dailyEntries.get(ROW_A)).toBeDefined()
  })

  it('moves the profile cursor on its own', async () => {
    const fake = fakeClient({
      serverRows: { profiles: [serverProfile('2026-09-02T12:00:00.000Z')] },
    })

    await pull(fake.client)

    expect(await cursor(PROFILE_CURSOR_KEY)).toBe('2026-09-02T12:00:00.000Z')
  })
})

describe('sync', () => {
  it('reports offline and touches no network when the browser is offline', async () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true })
    await append('daily_entries', 'upsert', localEntry(ROW_A))

    const outcome = await sync()

    expect(outcome).toEqual({ status: 'offline', pushed: 0, pulled: 0, error: null })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(await db.outbox.count()).toBe(1)
  })

  it('reports offline when no session is signed in', async () => {
    const fake = fakeClient({ user: null })
    mocks.createClient.mockReturnValue(fake.client)

    const outcome = await sync()

    expect(outcome.status).toBe('offline')
    expect(fake.upserted).toHaveLength(0)
  })

  it('pushes and then pulls', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_B, '2026-09-01T12:00:00.000Z', 3000)] },
    })
    mocks.createClient.mockReturnValue(fake.client)

    const outcome = await sync()

    expect(outcome).toEqual({ status: 'synced', pushed: 1, pulled: 1, error: null })
  })

  it('reports an error when the push fails', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({ upsertThrows: ['daily_entries'] })
    mocks.createClient.mockReturnValue(fake.client)

    const outcome = await sync()

    expect(outcome.status).toBe('error')
    expect(outcome.error).toBe('the fetch was aborted')
  })

  it('reports an error when the pull fails', async () => {
    const fake = fakeClient({ selectError: { daily_entries: 'network down' } })
    mocks.createClient.mockReturnValue(fake.client)

    const outcome = await sync()

    expect(outcome.status).toBe('error')
    expect(outcome.error).toBe('network down')
  })

  it('reports an error when the pull throws instead of answering', async () => {
    const fake = fakeClient({ selectThrows: ['daily_entries'] })
    mocks.createClient.mockReturnValue(fake.client)

    const outcome = await sync()

    expect(outcome.status).toBe('error')
    expect(outcome.error).toBe('the fetch was aborted')
  })

  it('reports an error when the session read throws', async () => {
    const fake = fakeClient({ getUserThrows: true })
    mocks.createClient.mockReturnValue(fake.client)

    const outcome = await sync()

    expect(outcome.status).toBe('error')
    expect(outcome.error).toBe('the session could not be read')
  })

  it('reports an error when the client cannot be built', async () => {
    mocks.createClient.mockImplementation(() => {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing')
    })

    const outcome = await sync()

    expect(outcome.status).toBe('error')
    expect(outcome.error).toBe('NEXT_PUBLIC_SUPABASE_URL is missing')
  })

  it('reports a rejection that is not an Error object', async () => {
    mocks.createClient.mockReturnValue({
      auth: { getUser: vi.fn().mockRejectedValue('the session broke') },
    })

    const outcome = await sync()

    expect(outcome.status).toBe('error')
    expect(outcome.error).toBe('the session broke')
  })

  it('never pushes the same entry twice when two drains start at once', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const [first, second] = await Promise.all([sync(), sync()])

    expect(fake.upserted).toHaveLength(1)
    expect(first).toEqual(second)
    expect(mocks.createClient).toHaveBeenCalledTimes(1)
  })

  it('runs again after the first drain settles', async () => {
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    await sync()
    await sync()

    expect(mocks.createClient).toHaveBeenCalledTimes(2)
  })

  it('leaves the queue untouched when the session is missing', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({ user: null })
    mocks.createClient.mockReturnValue(fake.client)

    await sync()

    expect(await listPending()).toHaveLength(1)
  })
})

describe('the sync state', () => {
  it('moves from syncing to synced and tells every listener', async () => {
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)
    const seen: SyncState[] = []
    const stop = subscribeSyncState(() => {
      seen.push(getSyncState())
    })

    await sync()
    stop()

    expect(seen).toEqual(['syncing', 'synced'])
    expect(getSyncState()).toBe('synced')
  })

  it('stops telling a listener that dropped out', async () => {
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)
    const listener = vi.fn()
    const stop = subscribeSyncState(listener)
    stop()

    await sync()

    expect(listener).not.toHaveBeenCalled()
  })

  it('reports offline while the browser has no network', async () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true })

    await sync()

    expect(getSyncState()).toBe('offline')
  })
})

describe('startSync', () => {
  it('syncs at start, on the online event and on every interval', async () => {
    vi.useFakeTimers()
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const stop = startSync()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.createClient).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.createClient).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS)
    expect(mocks.createClient).toHaveBeenCalledTimes(3)

    stop()
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS * 2)
    expect(mocks.createClient).toHaveBeenCalledTimes(3)
  })

  it('skips the interval tick while the browser is offline', async () => {
    vi.useFakeTimers()
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const stop = startSync()
    await vi.advanceTimersByTimeAsync(0)
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true })

    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS)

    expect(mocks.createClient).toHaveBeenCalledTimes(1)
    stop()
  })
})
