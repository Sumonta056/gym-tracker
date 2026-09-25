import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DAILY_CURSOR_KEY,
  db,
  DEAD_STREAK_KEY,
  PROFILE_CURSOR_KEY,
  SIGNED_OUT_KEY,
} from '../db/dexie'
import { clearAll, LOCAL_PROFILE_ID, SignedOutOnThisDevice, upsertDay } from '../db/repository'
import { dailyEntrySchema } from '../schema/dailyEntry'
import { profileSchema } from '../schema/profile'

import { MAX_ATTEMPTS, MAX_CONSECUTIVE_DEAD, moveToDeadLetters } from './deadLetters'
import { append, listPending, markFailed } from './outbox'
import {
  DRAIN_LOCK,
  DrainLockBusy,
  drainForSignOut,
  DUPLICATE_KEY,
  getSyncState,
  HALT_CHANNEL,
  HALT_LIMIT_MS,
  HALT_TIMEOUT_MS,
  haltSync,
  LOCK_TIMEOUT_MS,
  pull,
  push,
  resumeSync,
  SIGN_OUT_MARKER,
  startSync,
  subscribeSyncState,
  SYNC_INTERVAL_MS,
  SYNC_STOPPED,
  sync,
  withDrainLock,
} from './worker'

import type { SyncState } from './worker'
import type { DailyEntry, Profile } from '../db/dexie'
import type { Database } from '../supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

const USER_ID = '99999999-9999-4999-8999-999999999999'
const ROW_A = '11111111-1111-4111-8111-111111111111'
const ROW_B = '22222222-2222-4222-8222-222222222222'
const ROW_C = '33333333-3333-4333-8333-333333333333'
const ROW_D = '44444444-4444-4444-8444-444444444444'
const ROW_E = '55555555-5555-4555-8555-555555555555'
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
  getUserHangs?: boolean
  serverRows?: Record<string, Record<string, unknown>[]>
  serverStamp?: string
  upsertError?: Record<string, Failure>
  upsertErrorAlways?: boolean
  laterUpsertError?: Failure
  failures?: (Failure | null)[]
  onUpsert?: () => Promise<void>
  onSelect?: () => Promise<void>
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

    if (options.failures !== undefined) {
      const planned = options.failures[attempt - 1] ?? null

      return planned === null
        ? { data: { updated_at: SERVER_STAMP }, error: null }
        : { data: null, error: planned }
    }

    const failure = options.upsertError?.[table]

    if (failure !== undefined && (attempt === 1 || options.upsertErrorAlways === true)) {
      return { data: null, error: failure }
    }

    if (options.laterUpsertError !== undefined && attempt > 1) {
      return { data: null, error: options.laterUpsertError }
    }

    if (options.silentUpsert?.includes(table) === true) {
      return { data: null, error: null }
    }

    return { data: { updated_at: options.serverStamp ?? SERVER_STAMP }, error: null }
  }

  async function listAnswer(table: string): Promise<unknown> {
    await options.onSelect?.()

    if (options.selectThrows?.includes(table) === true) {
      throw new Error('the fetch was aborted')
    }

    const failure = options.selectError?.[table]

    if (failure !== undefined) {
      return { data: null, error: { message: failure } }
    }

    return { data: options.serverRows?.[table] ?? [], error: null }
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
        if (options.getUserHangs === true) {
          return new Promise(() => undefined)
        }

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

function hang(): Promise<void> {
  return new Promise(() => undefined)
}

interface LockRequestOptions {
  signal?: AbortSignal
}

type LockCallback = () => Promise<unknown>

interface FakeLocks {
  names: string[]
  request: (
    name: string,
    optionsOrCallback: LockRequestOptions | LockCallback,
    maybeCallback?: LockCallback,
  ) => Promise<unknown>
}

function fakeLocks(): FakeLocks {
  let tail: Promise<unknown> = Promise.resolve()
  const names: string[] = []

  return {
    names,
    request: (name, optionsOrCallback, maybeCallback) => {
      names.push(name)
      const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
      let granted = false
      const turn = tail.then(() => {
        if (options.signal?.aborted === true) {
          return undefined
        }

        granted = true

        return callback?.()
      })
      tail = turn.catch(() => undefined)

      return new Promise((resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => {
            if (!granted) {
              reject(new DOMException('The lock request was aborted.', 'AbortError'))
            }
          },
          { once: true },
        )
        turn.then(resolve, reject)
      })
    },
  }
}

class FakeChannel {
  static open: FakeChannel[] = []

  onmessage: ((event: { data: unknown }) => void) | null = null

  closed = false

  constructor(readonly name: string) {
    FakeChannel.open.push(this)
  }

  postMessage(data: unknown): void {
    for (const other of FakeChannel.open) {
      if (other !== this && !other.closed && other.name === this.name) {
        other.onmessage?.({ data })
      }
    }
  }

  close(): void {
    this.closed = true
  }
}

function otherTabSays(message: string): void {
  const channel = new FakeChannel(HALT_CHANNEL)
  channel.postMessage(message)
  channel.close()
}

function anotherTabSignsOut(until: number = Date.now() + HALT_LIMIT_MS): void {
  globalThis.localStorage.setItem(SIGN_OUT_MARKER, JSON.stringify({ owner: 'another-tab', until }))
  otherTabSays('halt')
}

function signedIn(): Promise<{ status: 'signed-out' }> {
  return Promise.resolve({ status: 'signed-out' })
}

function endSessionOnServer(): Promise<{ status: 'signed-out' }> {
  mocks.createClient.mockReturnValue(fakeClient({ user: null }).client)

  return signedIn()
}

async function drained(calls: number): Promise<void> {
  await vi.waitFor(() => {
    expect(mocks.createClient).toHaveBeenCalledTimes(calls)
    expect(getSyncState()).not.toBe('syncing')
  })
}

function installLocks(locks: FakeLocks): void {
  Object.defineProperty(globalThis.navigator, 'locks', { value: locks, configurable: true })
}

beforeEach(async () => {
  mocks.createClient.mockReset()
  await db.open()
  await Promise.all([
    db.dailyEntries.clear(),
    db.profiles.clear(),
    db.outbox.clear(),
    db.deadLetters.clear(),
    db.syncMeta.clear(),
  ])
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
  FakeChannel.open = []
  vi.stubGlobal('BroadcastChannel', FakeChannel)
  globalThis.localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  resumeSync()
  Reflect.deleteProperty(globalThis.navigator, 'locks')
  vi.unstubAllGlobals()
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

describe('the dead-letter move', () => {
  it('moves an entry with a permanent error out of the way, and the next entry syncs', async () => {
    const blocked = await append('daily_entries', 'upsert', localEntry(ROW_A))
    const next = await append('daily_entries', 'upsert', localEntry(ROW_B))
    const fake = fakeClient({
      upsertError: { daily_entries: { message: 'row level security', code: '42501' } },
    })

    const result = await push(fake.client, USER_ID, Date.parse('2026-09-01T10:00:00.000Z'))

    expect(result).toEqual({ pushed: 1, error: null })
    expect(fake.upserted.map((call) => call.row.id)).toEqual([ROW_A, ROW_B])
    expect(await db.outbox.get(next.id)).toBeUndefined()
    expect(await listPending()).toEqual([])
    expect(await db.deadLetters.get(blocked.id)).toMatchObject({
      id: blocked.id,
      row_id: ROW_A,
      attempts: 1,
      error_code: '42501',
      last_error: 'row level security',
      failed_at: '2026-09-01T10:00:00.000Z',
    })
  })

  it('stops the drain after three refusals in a row and leaves the rest queued', async () => {
    const entries = []
    for (const id of [ROW_A, ROW_B, ROW_C, ROW_D]) {
      entries.push(await append('daily_entries', 'upsert', localEntry(id)))
    }
    const fake = fakeClient({
      upsertError: { daily_entries: { message: 'row level security', code: '42501' } },
      upsertErrorAlways: true,
    })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(MAX_CONSECUTIVE_DEAD).toBe(3)
    expect(result).toEqual({ pushed: 0, error: 'row level security' })
    expect(fake.upserted).toHaveLength(3)
    expect(await db.deadLetters.count()).toBe(3)
    expect((await listPending()).map((entry) => entry.id)).toEqual([entries[3]?.id])
  })

  it('resets the refusal count after a success', async () => {
    for (const id of [ROW_A, ROW_B, ROW_C, ROW_D, ROW_E]) {
      await append('daily_entries', 'upsert', localEntry(id))
    }
    const refused = { message: 'row level security', code: '42501' }
    const fake = fakeClient({ failures: [refused, refused, null, refused, refused] })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result).toEqual({ pushed: 1, error: null })
    expect(await db.deadLetters.count()).toBe(4)
    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps the refusal count across turns, so a server that refuses every write moves only three', async () => {
    const entries = []
    for (const id of [ROW_A, ROW_B, ROW_C, ROW_D, ROW_E]) {
      entries.push(await append('daily_entries', 'upsert', localEntry(id)))
    }
    const fake = fakeClient({
      upsertError: { daily_entries: { message: 'row level security', code: '42501' } },
      upsertErrorAlways: true,
    })
    const nowMs = Date.parse('2026-09-01T10:00:00.000Z')

    await push(fake.client, USER_ID, nowMs)
    const second = await push(fake.client, USER_ID, nowMs + SYNC_INTERVAL_MS)

    expect(second).toEqual({ pushed: 0, error: 'row level security' })
    expect(await db.deadLetters.count()).toBe(MAX_CONSECUTIVE_DEAD)
    expect((await listPending()).map((entry) => entry.id)).toEqual([entries[3]?.id, entries[4]?.id])
    expect(await db.outbox.get(entries[3]?.id ?? '')).toMatchObject({
      attempts: 1,
      last_error: 'row level security',
      next_attempt_at: new Date(nowMs + SYNC_INTERVAL_MS + 1000).toISOString(),
    })
  })

  it('clears the refusal count on a success in a later turn', async () => {
    for (const id of [ROW_A, ROW_B, ROW_C, ROW_D, ROW_E]) {
      await append('daily_entries', 'upsert', localEntry(id))
    }
    const refused = { message: 'row level security', code: '42501' }
    const fake = fakeClient({ failures: [refused, refused, refused, null, refused] })

    await push(fake.client, USER_ID, Date.now())
    const second = await push(fake.client, USER_ID, Date.now())

    expect(second).toEqual({ pushed: 1, error: null })
    expect(await db.deadLetters.count()).toBe(4)
    expect(await db.outbox.count()).toBe(0)
    expect(await cursor(DEAD_STREAK_KEY)).toBe('1')
  })

  it('still moves an entry at the attempt ceiling while the refusal count is at its cap', async () => {
    await db.syncMeta.put({ key: DEAD_STREAK_KEY, value: String(MAX_CONSECUTIVE_DEAD) })
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    await db.outbox.update(entry.id, { attempts: MAX_ATTEMPTS - 1 })
    const fake = fakeClient({
      upsertError: { daily_entries: { message: 'row level security', code: '42501' } },
    })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result).toEqual({ pushed: 0, error: 'row level security' })
    expect(await db.deadLetters.get(entry.id)).toMatchObject({ attempts: MAX_ATTEMPTS })
    expect(await cursor(DEAD_STREAK_KEY)).toBe(String(MAX_CONSECUTIVE_DEAD + 1))
  })

  it('reads a refusal count it cannot parse as none', async () => {
    await db.syncMeta.put({ key: DEAD_STREAK_KEY, value: 'not a number' })
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({
      upsertError: { daily_entries: { message: 'row level security', code: '42501' } },
    })

    await push(fake.client, USER_ID, Date.now())

    expect(await db.deadLetters.get(entry.id)).toBeDefined()
    expect(await cursor(DEAD_STREAK_KEY)).toBe('1')
  })

  it('keeps an entry with a transient error at the head, with the back-off', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    await append('daily_entries', 'upsert', localEntry(ROW_B))
    const fake = fakeClient({
      upsertError: { daily_entries: { message: 'statement timeout', code: '57014' } },
    })

    const result = await push(fake.client, USER_ID, Date.parse('2026-09-01T10:00:00.000Z'))

    expect(result).toEqual({ pushed: 0, error: 'statement timeout' })
    expect(fake.upserted).toHaveLength(1)
    expect(await db.deadLetters.count()).toBe(0)
    expect((await listPending())[0]).toMatchObject({
      id: entry.id,
      attempts: 1,
      next_attempt_at: '2026-09-01T10:00:01.000Z',
    })
  })

  it('moves an entry after the attempt ceiling, and the next entry syncs', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    await append('daily_entries', 'upsert', localEntry(ROW_B))
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      await markFailed(entry.id, 'network down', 0)
    }
    const fake = fakeClient({ upsertError: { daily_entries: { message: 'network down' } } })

    const result = await push(fake.client, USER_ID, Date.now())

    expect(result).toEqual({ pushed: 1, error: null })
    expect(await db.outbox.count()).toBe(0)
    expect(await db.deadLetters.get(entry.id)).toMatchObject({
      attempts: MAX_ATTEMPTS,
      error_code: null,
      last_error: 'network down',
    })
  })

  it('keeps an entry one attempt short of the ceiling', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    for (let attempt = 1; attempt < MAX_ATTEMPTS - 1; attempt += 1) {
      await markFailed(entry.id, 'network down', 0)
    }
    const fake = fakeClient({ upsertThrows: ['daily_entries'] })

    await push(fake.client, USER_ID, Date.now())

    expect(await db.deadLetters.count()).toBe(0)
    expect((await db.outbox.get(entry.id))?.attempts).toBe(MAX_ATTEMPTS - 1)
  })

  it('carries the code of a failed duplicate lookup', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient({
      upsertError: { daily_entries: { message: 'duplicate key', code: DUPLICATE_KEY } },
      lookupError: 'permission denied',
    })

    await push(fake.client, USER_ID, Date.now())

    expect(await db.outbox.get(entry.id)).toMatchObject({ last_error: 'permission denied' })
  })

  it('moves the re-keyed entry when the adopted push fails for good', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    await db.dailyEntries.put(localEntry(ROW_A))
    const fake = fakeClient({
      upsertError: { daily_entries: { message: 'duplicate key', code: DUPLICATE_KEY } },
      laterUpsertError: { message: 'check violation', code: '23514' },
      liveRowId: ROW_B,
    })

    await push(fake.client, USER_ID, Date.now())

    expect(await db.outbox.count()).toBe(0)
    expect(await db.deadLetters.get(entry.id)).toMatchObject({
      row_id: ROW_B,
      error_code: '23514',
    })
  })
})

describe('the sign-out drain options', () => {
  it('sends an entry still in its back-off when asked to ignore it', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    await markFailed(entry.id, 'network down', Date.parse('2026-09-01T10:00:00.000Z'))
    const fake = fakeClient()

    const result = await push(fake.client, USER_ID, Date.parse('2026-09-01T10:00:00.100Z'), {
      ignoreBackoff: true,
    })

    expect(result).toEqual({ pushed: 1, error: null })
    expect(await db.outbox.count()).toBe(0)
  })

  it('stops at once and records nothing when the drain is stopped mid request', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    const stop = new AbortController()
    const fake = fakeClient({ onUpsert: hang })

    const pushing = push(fake.client, USER_ID, Date.now(), { signal: stop.signal })
    await vi.waitFor(() => {
      expect(fake.upserted).toHaveLength(1)
    })
    stop.abort()

    expect(await pushing).toEqual({ pushed: 0, error: SYNC_STOPPED })
    expect(await db.outbox.get(entry.id)).toEqual(entry)
  })

  it('writes nothing from a pull that was stopped before its answer came', async () => {
    const stop = new AbortController()
    stop.abort()
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_A, SERVER_STAMP, 5)] },
    })

    await expect(pull(fake.client, stop.signal)).rejects.toThrow(SYNC_STOPPED)

    expect(await db.dailyEntries.count()).toBe(0)
    expect(await cursor(DAILY_CURSOR_KEY)).toBeUndefined()
  })
  it('stops a pull between two rows once the drain is stopped, and leaves the cursor', async () => {
    const stop = new AbortController()
    const fake = fakeClient({
      serverRows: {
        daily_entries: [
          serverEntry(ROW_A, '2026-09-01T11:00:00.000Z', 5),
          serverEntry(ROW_B, '2026-09-01T12:00:00.000Z', 6),
        ],
      },
    })
    const put = db.dailyEntries.put.bind(db.dailyEntries)
    const spy = vi.spyOn(db.dailyEntries, 'put').mockImplementation((row) => {
      stop.abort()
      return put(row)
    })

    await expect(pull(fake.client, stop.signal)).rejects.toThrow(SYNC_STOPPED)
    spy.mockRestore()

    expect(await db.dailyEntries.count()).toBe(1)
    expect(await cursor(DAILY_CURSOR_KEY)).toBeUndefined()
  })

  it('stops a profile pull between two rows once the drain is stopped', async () => {
    const stop = new AbortController()
    const fake = fakeClient({
      serverRows: {
        profiles: [serverProfile('2026-09-01T11:00:00.000Z'), serverProfile(SERVER_STAMP)],
      },
    })
    const put = db.profiles.put.bind(db.profiles)
    const spy = vi.spyOn(db.profiles, 'put').mockImplementation((row) => {
      stop.abort()
      return put(row)
    })

    await expect(pull(fake.client, stop.signal)).rejects.toThrow(SYNC_STOPPED)
    spy.mockRestore()

    expect(await cursor(PROFILE_CURSOR_KEY)).toBeUndefined()
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

  it('moves a failed write for that row onto the server id too, so a retry keeps no orphan id', async () => {
    await db.dailyEntries.put(localEntry(ROW_A, { steps: 7000 }))
    const refused = await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 6000 }))
    await moveToDeadLetters(refused.id, '42501', 'rls', Date.now())
    await append('daily_entries', 'upsert', localEntry(ROW_A, { steps: 7000 }))
    const fake = fakeClient({ upsertError: { daily_entries: duplicate }, liveRowId: ROW_B })

    await push(fake.client, USER_ID, Date.now())

    const letter = await db.deadLetters.get(refused.id)
    expect(letter?.row_id).toBe(ROW_B)
    expect(letter?.payload.id).toBe(ROW_B)
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

describe('haltSync', () => {
  it('resolves at once when no drain is running', async () => {
    await expect(haltSync()).resolves.toBeUndefined()
  })

  it('waits for the drain in flight to settle before it resolves', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const order: string[] = []
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fake = fakeClient({ onUpsert: () => gate })
    mocks.createClient.mockReturnValue(fake.client)

    const drain = sync().then(() => order.push('drain'))
    await vi.waitFor(() => {
      expect(fake.upserted).toHaveLength(1)
    })
    const halted = haltSync().then(() => order.push('halt'))
    release()
    await Promise.all([drain, halted])

    expect(order).toEqual(['drain', 'halt'])
  })

  it('stops every later drain from touching the network or the outbox', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    await haltSync()
    const outcome = await sync()

    expect(outcome).toEqual({ status: 'offline', pushed: 0, pulled: 0, error: null })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(await db.outbox.count()).toBe(1)
  })

  it('leaves the reported state alone while halted', async () => {
    await haltSync()
    const listener = vi.fn()
    const stop = subscribeSyncState(listener)

    await sync()
    stop()

    expect(listener).not.toHaveBeenCalled()
  })

  it('lets the next drain run again after resumeSync', async () => {
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    await haltSync()
    resumeSync()
    const outcome = await sync()

    expect(outcome.status).toBe('synced')
    expect(mocks.createClient).toHaveBeenCalledTimes(1)
  })

  it('resolves within the timeout even when a request hangs', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    vi.useFakeTimers()
    const fake = fakeClient({ onUpsert: hang })
    mocks.createClient.mockReturnValue(fake.client)
    let done = false

    const drain = sync()
    const halting = haltSync().then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(HALT_TIMEOUT_MS - 1)
    expect(fake.upserted).toHaveLength(1)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await halting
    vi.useRealTimers()

    expect(done).toBe(true)
    expect(await drain).toMatchObject({ status: 'error', error: SYNC_STOPPED })
    expect(await db.outbox.get(entry.id)).toEqual(entry)
  })

  it('resolves within the timeout even when the session read hangs', async () => {
    vi.useFakeTimers()
    const fake = fakeClient({ getUserHangs: true })
    mocks.createClient.mockReturnValue(fake.client)

    const drain = sync()
    const halting = haltSync()
    await vi.advanceTimersByTimeAsync(HALT_TIMEOUT_MS)

    await expect(halting).resolves.toBeUndefined()
    expect(await drain).toMatchObject({ status: 'error', error: SYNC_STOPPED })
  })

  it('resolves when the drain it waits for rejects', async () => {
    installLocks({
      names: [],
      request: () => Promise.reject(new Error('the lock manager broke')),
    })
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const drain = sync()
    const halting = haltSync()

    await expect(drain).rejects.toThrow('the lock manager broke')
    await expect(halting).resolves.toBeUndefined()
  })

  it('takes a shorter timeout when one is given', async () => {
    vi.useFakeTimers()
    const fake = fakeClient({ getUserHangs: true })
    mocks.createClient.mockReturnValue(fake.client)
    let done = false

    void sync()
    const halting = haltSync(100).then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(100)
    await halting

    expect(done).toBe(true)
  })

  it('lets a fresh drain run after resumeSync follows a timed out halt', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    vi.useFakeTimers()
    const hung = fakeClient({ onUpsert: hang })
    mocks.createClient.mockReturnValue(hung.client)
    const first = sync()
    const halting = haltSync()
    await vi.advanceTimersByTimeAsync(HALT_TIMEOUT_MS)
    await halting
    await first
    expect(hung.upserted).toHaveLength(1)
    vi.useRealTimers()

    resumeSync()
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)
    const outcome = await sync()

    expect(outcome).toMatchObject({ status: 'synced', pushed: 1 })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('drainForSignOut', () => {
  it('sends a write still in its back-off, so it never reaches the confirm count', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    await markFailed(entry.id, 'network down', Date.now())
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    await drainForSignOut()

    expect(fake.upserted).toHaveLength(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('leaves the worker halted when it is done', async () => {
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    await drainForSignOut()
    const outcome = await sync()

    expect(outcome).toEqual({ status: 'offline', pushed: 0, pulled: 0, error: null })
    expect(mocks.createClient).toHaveBeenCalledTimes(1)
  })

  it('touches no network while the browser is offline', async () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true })

    await drainForSignOut()

    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('runs no second drain when the worker is already halted', async () => {
    await haltSync()

    await drainForSignOut()

    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('waits for a drain in flight, then drains again past the back-off', async () => {
    const entry = await append('daily_entries', 'upsert', localEntry(ROW_A))
    const at = Date.now()
    await markFailed(entry.id, 'network down', at)
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const slow = fakeClient({ serverRows: {}, onUpsert: () => gate })
    mocks.createClient.mockReturnValueOnce(slow.client)
    const regular = sync()
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const signingOut = drainForSignOut()
    release()
    await regular
    await signingOut

    expect(slow.upserted).toHaveLength(0)
    expect(fake.upserted).toHaveLength(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('finishes within the timeout even with a hung request', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    vi.useFakeTimers()
    const fake = fakeClient({ onUpsert: hang })
    mocks.createClient.mockReturnValue(fake.client)
    let done = false

    const signingOut = drainForSignOut().then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(HALT_TIMEOUT_MS)
    await signingOut
    vi.useRealTimers()

    expect(done).toBe(true)
    expect(fake.upserted).toHaveLength(1)
    expect(await db.outbox.count()).toBe(1)
  })
})

describe('the cross-tab halt', () => {
  it('halts this tab while another tab signs out, and syncs again once that sign-out ends', async () => {
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)
    const stop = startSync()
    await vi.waitFor(() => {
      expect(getSyncState()).toBe('synced')
    })

    anotherTabSignsOut()
    const halted = await sync()
    const stateWhileHalted = getSyncState()
    globalThis.localStorage.removeItem(SIGN_OUT_MARKER)
    const resumed = await sync()
    stop()

    expect(halted).toEqual({ status: 'offline', pushed: 0, pulled: 0, error: null })
    expect(stateWhileHalted).toBe('offline')
    expect(resumed.status).toBe('synced')
    expect(mocks.createClient).toHaveBeenCalledTimes(2)
  })

  it('stops a drain in flight when another tab signs out', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fake = fakeClient({ onSelect: () => gate })
    mocks.createClient.mockReturnValue(fake.client)
    const stop = startSync()
    await vi.waitFor(() => {
      expect(fake.selected).toHaveLength(1)
    })

    anotherTabSignsOut()
    const outcome = await sync()
    await vi.waitFor(() => {
      expect(getSyncState()).toBe('error')
    })
    release()
    stop()

    expect(outcome).toEqual({ status: 'offline', pushed: 0, pulled: 0, error: null })
  })

  it('ignores a message it does not know', async () => {
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)
    const stop = startSync()

    otherTabSays('something else')
    const outcome = await sync()
    stop()

    expect(outcome.status).toBe('synced')
  })

  it('never lifts the sign-out of another tab when this tab resumes its own', async () => {
    mocks.createClient.mockReturnValue(fakeClient().client)
    anotherTabSignsOut()

    resumeSync()
    const outcome = await sync()

    expect(outcome.status).toBe('offline')
    expect(globalThis.localStorage.getItem(SIGN_OUT_MARKER)).not.toBeNull()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('stops listening once every caller stopped', async () => {
    mocks.createClient.mockReturnValue(fakeClient().client)

    startSync()()
    await drained(1)

    expect(FakeChannel.open.every((channel) => channel.closed)).toBe(true)
  })

  it('keeps a second tab from pulling into the device once it is cleared', async () => {
    const locks = fakeLocks()
    installLocks(locks)
    await db.dailyEntries.put(localEntry(ROW_A))
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fake = fakeClient({
      onSelect: () => gate,
      serverRows: { daily_entries: [serverEntry(ROW_B, SERVER_STAMP, 5)] },
    })
    mocks.createClient.mockReturnValue(fake.client)
    const stop = startSync()
    await vi.waitFor(() => {
      expect(fake.selected).toHaveLength(1)
    })
    vi.resetModules()
    const signingOutTab = await import('../db/repository')

    await signingOutTab.clearAll({ count: 0, sequence: 0 }, endSessionOnServer)
    release()
    const later = await sync()
    stop()

    expect(await db.dailyEntries.count()).toBe(0)
    expect(await cursor(DAILY_CURSOR_KEY)).toBeUndefined()
    expect(later.status).toBe('offline')
    expect(fake.selected).toHaveLength(1)
    expect(locks.names).toEqual([DRAIN_LOCK, DRAIN_LOCK, DRAIN_LOCK])
  })

  it('keeps every tab out of the cleared device until the sign-out ends, even a tab that loads or resumes meanwhile', async () => {
    const locks = fakeLocks()
    installLocks(locks)
    await db.dailyEntries.put(localEntry(ROW_A))
    const fake = fakeClient({
      serverRows: { daily_entries: [serverEntry(ROW_B, SERVER_STAMP, 5)] },
    })
    mocks.createClient.mockReturnValue(fake.client)
    vi.resetModules()
    const signingOutTab = await import('../db/repository')
    let release: () => void = () => undefined
    const gate = new Promise<{ status: 'signed-out' }>((resolve) => {
      release = () => {
        void endSessionOnServer().then(resolve)
      }
    })

    const signingOut = signingOutTab.clearAll({ count: 0, sequence: 0 }, () => gate)
    await vi.waitFor(async () => {
      expect(await db.dailyEntries.count()).toBe(0)
    })
    vi.resetModules()
    const loadedTab = await import('./worker')
    const stopLoaded = loadedTab.startSync()
    resumeSync()
    const during = await Promise.all([sync(), loadedTab.sync()])
    release()
    await signingOut
    const after = await Promise.all([sync(), loadedTab.sync()])
    stopLoaded()

    expect(during.map((outcome) => outcome.status)).toEqual(['offline', 'offline'])
    expect(after.map((outcome) => outcome.status)).toEqual(['offline', 'offline'])
    expect(await db.dailyEntries.count()).toBe(0)
    expect(await cursor(DAILY_CURSOR_KEY)).toBeUndefined()
    expect(fake.selected).toEqual([])
  })

  it('drops a drain that waited for the lock while another tab began to sign out', async () => {
    const locks = fakeLocks()
    installLocks(locks)
    let release: () => void = () => undefined
    const otherTab = locks.request(
      DRAIN_LOCK,
      {},
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    mocks.createClient.mockReturnValue(fakeClient().client)

    const drain = sync()
    globalThis.localStorage.setItem(
      SIGN_OUT_MARKER,
      JSON.stringify({ owner: 'another-tab', until: Date.now() + HALT_LIMIT_MS }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    release()
    await otherTab

    expect(await drain).toEqual({ status: 'offline', pushed: 0, pulled: 0, error: null })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('lets the halt of a tab that closed mid sign-out end on its own after its limit', async () => {
    mocks.createClient.mockReturnValue(fakeClient().client)
    const before = Date.now()

    anotherTabSignsOut()
    const marker = JSON.parse(globalThis.localStorage.getItem(SIGN_OUT_MARKER) ?? 'null') as {
      until: number
    }
    const halted = await sync()
    const now = vi.spyOn(Date, 'now').mockReturnValue(marker.until + 1)
    const expired = await sync()
    now.mockRestore()

    expect(HALT_LIMIT_MS).toBe(15000)
    expect(marker.until).toBeGreaterThanOrEqual(before + HALT_LIMIT_MS)
    expect(halted.status).toBe('offline')
    expect(expired.status).toBe('synced')
  })

  it('still drains its own queue on its own sign-out while another tab signs out', async () => {
    anotherTabSignsOut()
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    await drainForSignOut()

    expect(fake.upserted).toHaveLength(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('ignores a sign-out marker that ends further away than its limit, as when the clock was set back', async () => {
    mocks.createClient.mockReturnValue(fakeClient().client)
    const realNow = Date.now()
    globalThis.localStorage.setItem(
      SIGN_OUT_MARKER,
      JSON.stringify({ owner: 'another-tab', until: realNow + HALT_LIMIT_MS }),
    )
    const now = vi.spyOn(Date, 'now').mockReturnValue(realNow - 3600000)

    const outcome = await sync()
    now.mockRestore()

    expect(outcome.status).toBe('synced')
  })

  it('ignores a sign-out marker it cannot read', async () => {
    mocks.createClient.mockReturnValue(fakeClient().client)
    globalThis.localStorage.setItem(SIGN_OUT_MARKER, 'not json')
    const unreadable = await sync()
    globalThis.localStorage.setItem(SIGN_OUT_MARKER, JSON.stringify({ until: 'soon' }))
    const wrongShape = await sync()

    expect(unreadable.status).toBe('synced')
    expect(wrongShape.status).toBe('synced')
  })

  it('syncs and signs out where the storage refuses every call', async () => {
    const refuse = (): never => {
      throw new Error('the storage is blocked')
    }
    const reads = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse)
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse)
    const removes = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(refuse)
    mocks.createClient.mockReturnValue(fakeClient().client)
    vi.resetModules()
    const repository = await import('../db/repository')

    const outcome = await sync()
    await repository.clearAll({ count: 0, sequence: 0 }, signedIn)
    repository.resumeSync()
    reads.mockRestore()
    writes.mockRestore()
    removes.mockRestore()

    expect(outcome.status).toBe('synced')
    expect(await db.dailyEntries.count()).toBe(0)
  })

  it('syncs and clears without a BroadcastChannel where the browser has none', async () => {
    Reflect.deleteProperty(globalThis, 'BroadcastChannel')
    expect('BroadcastChannel' in globalThis).toBe(false)
    await db.dailyEntries.put(localEntry(ROW_A))
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)
    vi.resetModules()
    const repository = await import('../db/repository')

    const stop = startSync()
    await vi.waitFor(() => {
      expect(mocks.createClient).toHaveBeenCalledTimes(1)
    })
    stop()
    await repository.clearAll({ count: 0, sequence: 0 }, signedIn)
    repository.resumeSync()

    expect(await db.dailyEntries.count()).toBe(0)
  })
})

describe('the sign-out limits', () => {
  function dayInput() {
    return dailyEntrySchema.parse({ entry_date: '2026-09-02', steps: 4000 })
  }

  it('gives up on the drain lock after its timeout, so a frozen tab cannot hold the sign-out', async () => {
    const locks = fakeLocks()
    installLocks(locks)
    void locks.request(DRAIN_LOCK, {}, hang)
    await db.dailyEntries.put(localEntry(ROW_A))
    const endSession = vi.fn(signedIn)
    vi.useFakeTimers()
    let settled: unknown = 'waiting'

    void clearAll({ count: 0, sequence: 0 }, endSession).then(
      () => {
        settled = 'cleared'
      },
      (cause: unknown) => {
        settled = cause
      },
    )
    await vi.advanceTimersByTimeAsync(LOCK_TIMEOUT_MS - 1)
    const beforeTimeout = settled
    await vi.advanceTimersByTimeAsync(1)
    vi.useRealTimers()

    expect(beforeTimeout).toBe('waiting')
    expect(settled).toBeInstanceOf(DrainLockBusy)
    expect(endSession).not.toHaveBeenCalled()
    expect(await db.dailyEntries.count()).toBe(1)
    expect(globalThis.localStorage.getItem(SIGN_OUT_MARKER)).toBeNull()
  })

  it('lets work that got the lock run past the lock timeout', async () => {
    installLocks(fakeLocks())
    vi.useFakeTimers()

    const work = withDrainLock(async () => {
      await new Promise((resolve) => setTimeout(resolve, LOCK_TIMEOUT_MS * 2))
      return 'done'
    }, LOCK_TIMEOUT_MS)
    await vi.advanceTimersByTimeAsync(LOCK_TIMEOUT_MS * 2)

    await expect(work).resolves.toBe('done')
  })

  it('refuses a save from another tab that lands after the clear, before the sign-out ends', async () => {
    installLocks(fakeLocks())
    mocks.createClient.mockReturnValue(fakeClient().client)
    vi.resetModules()
    const signingOutTab = await import('../db/repository')
    let ending = false
    let release: () => void = () => undefined
    const gate = new Promise<{ status: 'signed-out' }>((resolve) => {
      release = () => {
        void endSessionOnServer().then(resolve)
      }
    })

    const signingOut = signingOutTab.clearAll({ count: 0, sequence: 0 }, () => {
      ending = true
      return gate
    })
    await vi.waitFor(() => {
      expect(ending).toBe(true)
    })
    const saved = await upsertDay(dayInput()).then(
      () => 'saved',
      (cause: unknown) => cause,
    )
    release()
    await signingOut

    expect(saved).toBeInstanceOf(SignedOutOnThisDevice)
    expect(await db.dailyEntries.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps refusing saves after the sign-out until a drain reads a new sign-in', async () => {
    mocks.createClient.mockReturnValue(fakeClient().client)
    vi.resetModules()
    const signingOutTab = await import('../db/repository')

    await signingOutTab.clearAll({ count: 0, sequence: 0 }, endSessionOnServer)
    const signedOut = await sync()
    const refused = await upsertDay(dayInput()).then(
      () => 'saved',
      (cause: unknown) => cause,
    )
    mocks.createClient.mockReturnValue(fakeClient().client)
    const signedInAgain = await sync()
    const saved = await upsertDay(dayInput())

    expect(signedOut.status).toBe('offline')
    expect(refused).toBeInstanceOf(SignedOutOnThisDevice)
    expect(signedInAgain.status).toBe('synced')
    expect(saved.steps).toBe(4000)
    expect(await db.outbox.count()).toBe(1)
    expect(await db.syncMeta.get(SIGNED_OUT_KEY)).toBeUndefined()
  })

  it('resumes even when the device cannot lift its signed-out record', async () => {
    const lift = vi
      .spyOn(db.syncMeta, 'delete')
      .mockRejectedValueOnce(new Error('the database closed'))
    mocks.createClient.mockReturnValue(fakeClient().client)

    await clearAll({ count: 0, sequence: 0 }, signedIn)
    resumeSync()
    await vi.waitFor(() => {
      expect(lift).toHaveBeenCalledWith(SIGNED_OUT_KEY)
    })
    lift.mockRestore()

    expect((await sync()).status).toBe('synced')
  })

  it('lifts the sign-out marker once the sign-out ends, so a sign-in right after syncs at once', async () => {
    mocks.createClient.mockReturnValue(fakeClient().client)
    vi.resetModules()
    const signingOutTab = await import('../db/repository')

    await signingOutTab.clearAll({ count: 0, sequence: 0 }, endSessionOnServer)
    vi.resetModules()
    const signedInTab = await import('./worker')
    mocks.createClient.mockReturnValue(fakeClient().client)
    const outcome = await signedInTab.sync()

    expect(globalThis.localStorage.getItem(SIGN_OUT_MARKER)).toBeNull()
    expect(outcome.status).toBe('synced')
  })
})

describe('the drain lock', () => {
  it('drains inside the named lock where the browser offers one', async () => {
    const locks = fakeLocks()
    installLocks(locks)
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const outcome = await sync()

    expect(outcome.status).toBe('synced')
    expect(locks.names).toEqual([DRAIN_LOCK])
  })

  it('waits while another tab holds the lock', async () => {
    const locks = fakeLocks()
    installLocks(locks)
    let release: () => void = () => undefined
    const otherTab = locks.request(
      DRAIN_LOCK,
      {},
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const drain = sync()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mocks.createClient).not.toHaveBeenCalled()

    release()
    await otherTab

    expect((await drain).status).toBe('synced')
    expect(mocks.createClient).toHaveBeenCalledTimes(1)
  })

  it('never lets two tabs drain at the same time, so one entry is pushed once', async () => {
    const locks = fakeLocks()
    installLocks(locks)
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    let active = 0
    let most = 0
    const fake = fakeClient({
      onUpsert: async () => {
        active += 1
        most = Math.max(most, active)
        await new Promise((resolve) => setTimeout(resolve, 10))
        active -= 1
      },
    })
    mocks.createClient.mockReturnValue(fake.client)
    vi.resetModules()
    const otherTab = await import('./worker')
    const otherDexie = await import('../db/dexie')

    await Promise.all([sync(), otherTab.sync()])
    otherDexie.db.close()

    expect(most).toBe(1)
    expect(fake.upserted).toHaveLength(1)
    expect(locks.names).toEqual([DRAIN_LOCK, DRAIN_LOCK])
  })

  it('drains without a lock where the browser has none', async () => {
    expect('locks' in globalThis.navigator).toBe(false)
    await append('daily_entries', 'upsert', localEntry(ROW_A))
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const outcome = await sync()

    expect(outcome).toMatchObject({ status: 'synced', pushed: 1 })
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
    await drained(1)

    window.dispatchEvent(new Event('online'))
    await drained(2)

    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS)
    await drained(3)

    stop()
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS * 2)
    expect(mocks.createClient).toHaveBeenCalledTimes(3)
  })

  it('shares one set of triggers when it is started twice', async () => {
    vi.useFakeTimers()
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const stopFirst = startSync()
    const stopSecond = startSync()
    await drained(1)

    window.dispatchEvent(new Event('online'))
    await drained(2)

    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS - 1000)
    await vi.advanceTimersByTimeAsync(1000)
    await drained(3)

    stopFirst()
    window.dispatchEvent(new Event('online'))
    await drained(4)

    stopSecond()
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS * 2)
    expect(mocks.createClient).toHaveBeenCalledTimes(4)
  })

  it('ignores a second call to the same stop function', async () => {
    vi.useFakeTimers()
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const stopFirst = startSync()
    const stopSecond = startSync()
    await drained(1)
    stopFirst()
    stopFirst()

    window.dispatchEvent(new Event('online'))
    await drained(2)
    stopSecond()

    expect(mocks.createClient).toHaveBeenCalledTimes(2)
  })

  it('starts afresh, with a tick, after every caller stopped', async () => {
    vi.useFakeTimers()
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    startSync()()
    await drained(1)
    const stop = startSync()
    await drained(2)
    stop()

    expect(mocks.createClient).toHaveBeenCalledTimes(2)
  })

  it('touches no network from its triggers while halted', async () => {
    vi.useFakeTimers()
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    await haltSync()
    const stop = startSync()
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS * 2)

    expect(mocks.createClient).not.toHaveBeenCalled()
    stop()
  })

  it('skips the interval tick while the browser is offline', async () => {
    vi.useFakeTimers()
    const fake = fakeClient()
    mocks.createClient.mockReturnValue(fake.client)

    const stop = startSync()
    await drained(1)
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true })

    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS)

    expect(mocks.createClient).toHaveBeenCalledTimes(1)
    stop()
  })
})
