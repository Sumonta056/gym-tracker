import { DAILY_CURSOR_KEY, db, LOCAL_PROFILE_ID, PROFILE_CURSOR_KEY } from '../db/dexie'
import { createClient } from '../supabase/client'

import { hasPending, isDue, markDone, markFailed, nextPending, pendingCount } from './outbox'

import type { DailyEntry, OutboxEntry, Profile } from '../db/dexie'
import type { Database, Tables, TablesInsert } from '../supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SYNC_INTERVAL_MS = 30000

export const EPOCH = new Date(0).toISOString()

export const DUPLICATE_KEY = '23505'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface SyncOutcome {
  status: 'offline' | 'synced' | 'error'
  pushed: number
  pulled: number
  error: string | null
}

interface PushResult {
  pushed: number
  error: string | null
}

interface PullResult {
  pulled: number
  error: string | null
}

interface SendResult {
  error: string | null
}

type Client = SupabaseClient<Database>

let state: SyncState = 'idle'

const listeners = new Set<() => void>()

let draining: Promise<SyncOutcome> | null = null

let halted = false

export function getSyncState(): SyncState {
  return state
}

export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function setState(next: SyncState): void {
  state = next

  for (const listener of listeners) {
    listener()
  }
}

function isOnline(): boolean {
  return globalThis.navigator.onLine
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function toServerEntry(payload: DailyEntry, userId: string): TablesInsert<'daily_entries'> {
  return {
    id: payload.id,
    user_id: userId,
    entry_date: payload.entry_date,
    walk_seconds: payload.walk_seconds,
    gym_seconds: payload.gym_seconds,
    avg_heart_rate: payload.avg_heart_rate,
    max_heart_rate: payload.max_heart_rate,
    weight_kg: payload.weight_kg,
    calories_burnt: payload.calories_burnt,
    steps: payload.steps,
    note: payload.note,
    created_at: payload.created_at,
    deleted_at: payload.deleted_at,
  }
}

function toServerProfile(payload: Profile, userId: string): TablesInsert<'profiles'> {
  return {
    id: userId,
    display_name: payload.display_name,
    unit_system: payload.unit_system,
    height_cm: payload.height_cm,
    target_weight_kg: payload.target_weight_kg,
    step_goal: payload.step_goal,
  }
}

function toLocalEntry(row: Tables<'daily_entries'>): DailyEntry {
  return {
    id: row.id,
    entry_date: row.entry_date,
    walk_seconds: row.walk_seconds,
    gym_seconds: row.gym_seconds,
    avg_heart_rate: row.avg_heart_rate,
    max_heart_rate: row.max_heart_rate,
    weight_kg: row.weight_kg,
    calories_burnt: row.calories_burnt,
    steps: row.steps,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

function toLocalProfile(row: Tables<'profiles'>): Profile {
  return {
    id: LOCAL_PROFILE_ID,
    display_name: row.display_name,
    unit_system: row.unit_system === 'imperial' ? 'imperial' : 'metric',
    height_cm: row.height_cm,
    target_weight_kg: row.target_weight_kg,
    step_goal: row.step_goal,
    updated_at: row.updated_at,
  }
}

async function stampEntry(payload: DailyEntry, serverAt: string | undefined): Promise<void> {
  if (serverAt === undefined) {
    return
  }

  const local = await db.dailyEntries.get(payload.id)

  if (local === undefined || local.updated_at !== payload.updated_at) {
    return
  }

  await db.dailyEntries.put({ ...local, updated_at: serverAt })
}

async function stampProfile(payload: Profile, serverAt: string | undefined): Promise<void> {
  if (serverAt === undefined) {
    return
  }

  const local = await db.profiles.get(LOCAL_PROFILE_ID)

  if (local === undefined || local.updated_at !== payload.updated_at) {
    return
  }

  await db.profiles.put({ ...local, updated_at: serverAt })
}

async function claimServerId(payload: DailyEntry, toId: string): Promise<DailyEntry> {
  return db.transaction('rw', db.dailyEntries, db.outbox, async () => {
    const holder = await db.dailyEntries.get(toId)
    const winner: DailyEntry =
      holder !== undefined && holder.updated_at > payload.updated_at
        ? holder
        : { ...payload, id: toId }

    await db.dailyEntries.delete(payload.id)
    await db.dailyEntries.put(winner)

    const queued = await db.outbox.filter((entry) => entry.row_id === payload.id).toArray()

    for (const entry of queued) {
      await db.outbox.put({
        ...entry,
        row_id: toId,
        payload: { ...entry.payload, id: toId },
      })
    }

    return winner
  })
}

async function sendProfile(client: Client, payload: Profile, userId: string): Promise<SendResult> {
  const { data, error } = await client
    .from('profiles')
    .upsert(toServerProfile(payload, userId), { onConflict: 'id' })
    .select('updated_at')
    .maybeSingle()

  if (error !== null) {
    return { error: error.message }
  }

  await stampProfile(payload, data?.updated_at)

  return { error: null }
}

async function sendDailyEntry(
  client: Client,
  payload: DailyEntry,
  userId: string,
  mayAdopt: boolean,
): Promise<SendResult> {
  const { data, error } = await client
    .from('daily_entries')
    .upsert(toServerEntry(payload, userId), { onConflict: 'id' })
    .select('updated_at')
    .maybeSingle()

  if (error !== null) {
    if (mayAdopt && error.code === DUPLICATE_KEY) {
      return adoptServerDate(client, payload, userId)
    }

    return { error: error.message }
  }

  await stampEntry(payload, data?.updated_at)

  return { error: null }
}

async function adoptServerDate(
  client: Client,
  payload: DailyEntry,
  userId: string,
): Promise<SendResult> {
  const { data, error } = await client
    .from('daily_entries')
    .select('id')
    .eq('entry_date', payload.entry_date)
    .is('deleted_at', null)
    .maybeSingle()

  if (error !== null) {
    return { error: error.message }
  }

  const serverId = data?.id

  if (serverId === undefined || serverId === payload.id) {
    return { error: `the server holds another live row for ${payload.entry_date}` }
  }

  const winner = await claimServerId(payload, serverId)

  return sendDailyEntry(client, winner, userId, false)
}

async function sendEntry(client: Client, entry: OutboxEntry, userId: string): Promise<SendResult> {
  try {
    if (entry.table_name === 'profiles') {
      return await sendProfile(client, entry.payload as Profile, userId)
    }

    return await sendDailyEntry(client, entry.payload as DailyEntry, userId, true)
  } catch (cause) {
    return { error: errorMessage(cause) }
  }
}

export async function push(client: Client, userId: string, nowMs: number): Promise<PushResult> {
  let pushed = 0
  let remaining = await pendingCount()
  let entry = await nextPending()

  while (entry !== undefined && remaining > 0 && isDue(entry, nowMs)) {
    remaining -= 1

    const { error } = await sendEntry(client, entry, userId)

    if (error !== null) {
      await markFailed(entry.id, error, nowMs)

      return { pushed, error }
    }

    await markDone(entry.id)
    pushed += 1
    entry = await nextPending()
  }

  return { pushed, error: null }
}

async function readCursor(key: string): Promise<string> {
  const record = await db.syncMeta.get(key)

  return record?.value ?? EPOCH
}

async function moveCursor(key: string, from: string, to: string): Promise<void> {
  if (to > from) {
    await db.syncMeta.put({ key, value: to })
  }
}

async function acceptsServerRow(
  rowId: string,
  localUpdatedAt: string | undefined,
  serverUpdatedAt: string,
): Promise<boolean> {
  if (await hasPending(rowId)) {
    return false
  }

  return localUpdatedAt === undefined || serverUpdatedAt >= localUpdatedAt
}

async function pullDailyEntries(client: Client): Promise<PullResult> {
  const from = await readCursor(DAILY_CURSOR_KEY)
  const { data, error } = await client
    .from('daily_entries')
    .select('*')
    .gt('updated_at', from)
    .order('updated_at', { ascending: true })

  if (error !== null) {
    return { pulled: 0, error: error.message }
  }

  let pulled = 0
  let highWater = from
  let blocked = false

  for (const row of data) {
    const local = await db.dailyEntries.get(row.id)

    if (!(await acceptsServerRow(row.id, local?.updated_at, row.updated_at))) {
      blocked = true
      continue
    }

    await db.dailyEntries.put(toLocalEntry(row))
    pulled += 1

    if (!blocked && row.updated_at > highWater) {
      highWater = row.updated_at
    }
  }

  await moveCursor(DAILY_CURSOR_KEY, from, highWater)

  return { pulled, error: null }
}

async function pullProfiles(client: Client): Promise<PullResult> {
  const from = await readCursor(PROFILE_CURSOR_KEY)
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .gt('updated_at', from)
    .order('updated_at', { ascending: true })

  if (error !== null) {
    return { pulled: 0, error: error.message }
  }

  let pulled = 0
  let highWater = from
  let blocked = false

  for (const row of data) {
    const local = await db.profiles.get(LOCAL_PROFILE_ID)

    if (!(await acceptsServerRow(LOCAL_PROFILE_ID, local?.updated_at, row.updated_at))) {
      blocked = true
      continue
    }

    await db.profiles.put(toLocalProfile(row))
    pulled += 1

    if (!blocked && row.updated_at > highWater) {
      highWater = row.updated_at
    }
  }

  await moveCursor(PROFILE_CURSOR_KEY, from, highWater)

  return { pulled, error: null }
}

export async function pull(client: Client): Promise<PullResult> {
  const entries = await pullDailyEntries(client)

  if (entries.error !== null) {
    return entries
  }

  const profiles = await pullProfiles(client)

  if (profiles.error !== null) {
    return { pulled: entries.pulled, error: profiles.error }
  }

  return { pulled: entries.pulled + profiles.pulled, error: null }
}

function idle(status: 'offline'): SyncOutcome {
  setState(status)

  return { status, pushed: 0, pulled: 0, error: null }
}

function failed(error: string, pushed: number, pulled: number): SyncOutcome {
  setState('error')

  return { status: 'error', pushed, pulled, error }
}

async function readUserId(client: Client): Promise<string | undefined> {
  const { data } = await client.auth.getUser()

  return data.user?.id
}

async function runSync(): Promise<SyncOutcome> {
  if (!isOnline()) {
    return idle('offline')
  }

  setState('syncing')

  let client: Client

  try {
    client = createClient()
  } catch (cause) {
    return failed(errorMessage(cause), 0, 0)
  }

  try {
    const userId = await readUserId(client)

    if (userId === undefined) {
      return idle('offline')
    }

    const pushed = await push(client, userId, Date.now())

    if (pushed.error !== null) {
      return failed(pushed.error, pushed.pushed, 0)
    }

    const pulled = await pull(client)

    if (pulled.error !== null) {
      return failed(pulled.error, pushed.pushed, pulled.pulled)
    }

    setState('synced')

    return { status: 'synced', pushed: pushed.pushed, pulled: pulled.pulled, error: null }
  } catch (cause) {
    return failed(errorMessage(cause), 0, 0)
  }
}

export async function haltSync(): Promise<void> {
  halted = true

  await draining
}

export function resumeSync(): void {
  halted = false
}

export function sync(): Promise<SyncOutcome> {
  if (halted) {
    return Promise.resolve({ status: 'offline', pushed: 0, pulled: 0, error: null })
  }

  draining ??= runSync().finally(() => {
    draining = null
  })

  return draining
}

let triggers: { callers: number; teardown: () => void } | null = null

function mountTriggers(): () => void {
  const tick = (): void => {
    void sync()
  }

  tick()
  window.addEventListener('online', tick)

  const timer = window.setInterval(() => {
    if (isOnline()) {
      tick()
    }
  }, SYNC_INTERVAL_MS)

  return () => {
    window.removeEventListener('online', tick)
    window.clearInterval(timer)
  }
}

export function startSync(): () => void {
  if (triggers === null) {
    triggers = { callers: 0, teardown: mountTriggers() }
  }

  const shared = triggers
  let stopped = false

  shared.callers += 1

  return () => {
    if (stopped) {
      return
    }

    stopped = true
    shared.callers -= 1

    if (shared.callers === 0 && triggers === shared) {
      shared.teardown()
      triggers = null
    }
  }
}
