import {
  DAILY_CURSOR_KEY,
  db,
  LOCAL_PROFILE_ID,
  PROFILE_CURSOR_KEY,
  SIGNED_OUT_KEY,
} from '../db/dexie'
import { newId } from '../id'
import { createClient } from '../supabase/client'

import {
  isPermanent,
  MAX_ATTEMPTS,
  MAX_CONSECUTIVE_DEAD,
  moveToDeadLetters,
  readDeadStreak,
  writeDeadStreak,
} from './deadLetters'
import { hasPending, isDue, markDone, markFailed, nextPending, pendingCount } from './outbox'

import type { DailyEntry, OutboxEntry, Profile } from '../db/dexie'
import type { Database, Tables, TablesInsert } from '../supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SYNC_INTERVAL_MS = 30000

export const EPOCH = new Date(0).toISOString()

export const DUPLICATE_KEY = '23505'

export const HALT_TIMEOUT_MS = 5000

export const LOCK_TIMEOUT_MS = 5000

export const DRAIN_LOCK = 'gym-tracker-sync-drain'

export const HALT_CHANNEL = 'gym-tracker-sync-halt'

export const SIGN_OUT_MARKER = 'gym-tracker-signing-out'

export const HALT_LIMIT_MS = 15000

export const SYNC_STOPPED = 'the sync was stopped'

export class DrainLockBusy extends Error {
  constructor() {
    super('Another tab still holds the sync lock.')
    this.name = 'DrainLockBusy'
  }
}

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface SyncOutcome {
  status: 'offline' | 'synced' | 'error'
  pushed: number
  pulled: number
  error: string | null
}

export interface PushOptions {
  ignoreBackoff?: boolean
  signal?: AbortSignal
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
  code: string | null
}

type Client = SupabaseClient<Database>

let state: SyncState = 'idle'

const listeners = new Set<() => void>()

let draining: Promise<SyncOutcome> | null = null

let halted = false

let clearedHere = false

let stop = new AbortController()

let channel: BroadcastChannel | null = null

const TAB_ID = newId()

interface SignOutMarker {
  owner: string
  until: number
}

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

function codeOf(error: { code?: string }): string | null {
  return error.code === undefined || error.code === '' ? null : error.code
}

function untilStopped<T>(work: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const stopped = (): void => {
      reject(new Error(SYNC_STOPPED))
    }

    if (signal.aborted) {
      stopped()
      return
    }

    signal.addEventListener('abort', stopped, { once: true })
    work.then(
      (value) => {
        signal.removeEventListener('abort', stopped)
        resolve(value)
      },
      (cause: unknown) => {
        signal.removeEventListener('abort', stopped)
        reject(cause instanceof Error ? cause : new Error(String(cause)))
      },
    )
  })
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
  return db.transaction('rw', db.dailyEntries, db.outbox, db.deadLetters, async () => {
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

    const letters = await db.deadLetters.filter((letter) => letter.row_id === payload.id).toArray()

    for (const letter of letters) {
      await db.deadLetters.put({
        ...letter,
        row_id: toId,
        payload: { ...letter.payload, id: toId },
      })
    }

    return winner
  })
}

async function sendProfile(
  client: Client,
  payload: Profile,
  userId: string,
  signal: AbortSignal,
): Promise<SendResult> {
  const { data, error } = await untilStopped(
    client
      .from('profiles')
      .upsert(toServerProfile(payload, userId), { onConflict: 'id' })
      .select('updated_at')
      .maybeSingle(),
    signal,
  )

  if (error !== null) {
    return { error: error.message, code: codeOf(error) }
  }

  await stampProfile(payload, data?.updated_at)

  return { error: null, code: null }
}

async function sendDailyEntry(
  client: Client,
  payload: DailyEntry,
  userId: string,
  mayAdopt: boolean,
  signal: AbortSignal,
): Promise<SendResult> {
  const { data, error } = await untilStopped(
    client
      .from('daily_entries')
      .upsert(toServerEntry(payload, userId), { onConflict: 'id' })
      .select('updated_at')
      .maybeSingle(),
    signal,
  )

  if (error !== null) {
    if (mayAdopt && error.code === DUPLICATE_KEY) {
      return adoptServerDate(client, payload, userId, signal)
    }

    return { error: error.message, code: codeOf(error) }
  }

  await stampEntry(payload, data?.updated_at)

  return { error: null, code: null }
}

async function adoptServerDate(
  client: Client,
  payload: DailyEntry,
  userId: string,
  signal: AbortSignal,
): Promise<SendResult> {
  const { data, error } = await untilStopped(
    client
      .from('daily_entries')
      .select('id')
      .eq('entry_date', payload.entry_date)
      .is('deleted_at', null)
      .maybeSingle(),
    signal,
  )

  if (error !== null) {
    return { error: error.message, code: codeOf(error) }
  }

  const serverId = data?.id

  if (serverId === undefined || serverId === payload.id) {
    return { error: `the server holds another live row for ${payload.entry_date}`, code: null }
  }

  const winner = await claimServerId(payload, serverId)

  return sendDailyEntry(client, winner, userId, false, signal)
}

async function sendEntry(
  client: Client,
  entry: OutboxEntry,
  userId: string,
  signal: AbortSignal,
): Promise<SendResult> {
  try {
    if (entry.table_name === 'profiles') {
      return await sendProfile(client, entry.payload as Profile, userId, signal)
    }

    return await sendDailyEntry(client, entry.payload as DailyEntry, userId, true, signal)
  } catch (cause) {
    return { error: errorMessage(cause), code: null }
  }
}

export async function push(
  client: Client,
  userId: string,
  nowMs: number,
  options: PushOptions = {},
): Promise<PushResult> {
  const signal = options.signal ?? new AbortController().signal
  const ignoreBackoff = options.ignoreBackoff === true
  let pushed = 0
  let dead = await readDeadStreak()
  let remaining = await pendingCount()
  let entry = await nextPending()

  while (entry !== undefined && remaining > 0 && (ignoreBackoff || isDue(entry, nowMs))) {
    remaining -= 1

    const { error, code } = await sendEntry(client, entry, userId, signal)

    if (signal.aborted) {
      return { pushed, error: SYNC_STOPPED }
    }

    if (error === null) {
      await markDone(entry.id)
      pushed += 1

      if (dead > 0) {
        dead = 0
        await writeDeadStreak(dead)
      }
    } else if (
      entry.attempts + 1 >= MAX_ATTEMPTS ||
      (isPermanent(code) && dead < MAX_CONSECUTIVE_DEAD)
    ) {
      await moveToDeadLetters(entry.id, code, error, nowMs)
      dead += 1
      await writeDeadStreak(dead)

      if (dead >= MAX_CONSECUTIVE_DEAD) {
        return { pushed, error }
      }
    } else {
      await markFailed(entry.id, error, nowMs)

      return { pushed, error }
    }

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

async function pullDailyEntries(client: Client, signal: AbortSignal): Promise<PullResult> {
  const from = await readCursor(DAILY_CURSOR_KEY)
  const { data, error } = await untilStopped(
    client
      .from('daily_entries')
      .select('*')
      .gt('updated_at', from)
      .order('updated_at', { ascending: true }),
    signal,
  )

  if (error !== null) {
    return { pulled: 0, error: error.message }
  }

  let pulled = 0
  let highWater = from
  let blocked = false

  for (const row of data) {
    if (signal.aborted) {
      throw new Error(SYNC_STOPPED)
    }

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

async function pullProfiles(client: Client, signal: AbortSignal): Promise<PullResult> {
  const from = await readCursor(PROFILE_CURSOR_KEY)
  const { data, error } = await untilStopped(
    client
      .from('profiles')
      .select('*')
      .gt('updated_at', from)
      .order('updated_at', { ascending: true }),
    signal,
  )

  if (error !== null) {
    return { pulled: 0, error: error.message }
  }

  let pulled = 0
  let highWater = from
  let blocked = false

  for (const row of data) {
    if (signal.aborted) {
      throw new Error(SYNC_STOPPED)
    }

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

export async function pull(
  client: Client,
  signal: AbortSignal = new AbortController().signal,
): Promise<PullResult> {
  const entries = await pullDailyEntries(client, signal)

  if (entries.error !== null) {
    return entries
  }

  const profiles = await pullProfiles(client, signal)

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

async function runSync(
  options: PushOptions,
  signal: AbortSignal,
  own: boolean,
): Promise<SyncOutcome> {
  if (!own && signingOutElsewhere()) {
    return idle('offline')
  }

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
    const userId = await untilStopped(readUserId(client), signal)

    if (userId === undefined) {
      return idle('offline')
    }

    await db.syncMeta.delete(SIGNED_OUT_KEY)

    const pushed = await push(client, userId, Date.now(), { ...options, signal })

    if (pushed.error !== null) {
      return failed(pushed.error, pushed.pushed, 0)
    }

    const pulled = await pull(client, signal)

    if (pulled.error !== null) {
      return failed(pulled.error, pushed.pushed, pulled.pulled)
    }

    setState('synced')

    return { status: 'synced', pushed: pushed.pushed, pulled: pulled.pulled, error: null }
  } catch (cause) {
    return failed(errorMessage(cause), 0, 0)
  }
}

export function withDrainLock<T>(
  run: () => Promise<T>,
  timeoutMs: number | null = null,
): Promise<T> {
  const { navigator } = globalThis

  if (!('locks' in navigator)) {
    return run()
  }

  const waiting = new AbortController()
  const timer =
    timeoutMs === null
      ? undefined
      : setTimeout(() => {
          waiting.abort()
        }, timeoutMs)

  return new Promise<T>((resolve, reject) => {
    navigator.locks
      .request(DRAIN_LOCK, { signal: waiting.signal }, () => {
        clearTimeout(timer)

        return run().then(resolve, reject)
      })
      .catch((cause: unknown) => {
        clearTimeout(timer)
        if (waiting.signal.aborted) {
          reject(new DrainLockBusy())
        } else {
          reject(new Error(errorMessage(cause)))
        }
      })
  })
}

function isMarker(value: unknown): value is SignOutMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    'owner' in value &&
    typeof value.owner === 'string' &&
    'until' in value &&
    typeof value.until === 'number'
  )
}

function readMarker(): SignOutMarker | null {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage.getItem(SIGN_OUT_MARKER) ?? 'null')

    return isMarker(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeMarker(marker: SignOutMarker | null): void {
  try {
    if (marker === null) {
      globalThis.localStorage.removeItem(SIGN_OUT_MARKER)
    } else {
      globalThis.localStorage.setItem(SIGN_OUT_MARKER, JSON.stringify(marker))
    }
  } catch {
    return
  }
}

function signingOutElsewhere(): boolean {
  const marker = readMarker()

  const now = Date.now()

  return marker !== null && marker.until > now && marker.until <= now + HALT_LIMIT_MS
}

function openChannel(): BroadcastChannel | null {
  return 'BroadcastChannel' in globalThis ? new BroadcastChannel(HALT_CHANNEL) : null
}

function tellOtherTabsToHalt(): void {
  const target = channel ?? openChannel()

  target?.postMessage('halt')

  if (target !== channel) {
    target?.close()
  }
}

function hear(event: MessageEvent<unknown>): void {
  if (event.data === 'halt') {
    stop.abort()
  }
}

export function markSigningOut(): void {
  writeMarker({ owner: TAB_ID, until: Date.now() + HALT_LIMIT_MS })
  tellOtherTabsToHalt()
}

export function endSigningOut(): void {
  if (readMarker()?.owner === TAB_ID) {
    writeMarker(null)
  }
}

function startDrain(
  options: PushOptions,
  after: Promise<SyncOutcome> | null,
  own: boolean,
): Promise<SyncOutcome> {
  if (stop.signal.aborted && !halted && (own || !signingOutElsewhere())) {
    stop = new AbortController()
  }

  const signal = stop.signal
  const run = (): Promise<SyncOutcome> => withDrainLock(() => runSync(options, signal, own))
  const next: Promise<SyncOutcome> = (after === null ? run() : after.then(run, run)).finally(() => {
    if (draining === next) {
      draining = null
    }
  })

  return next
}

export async function haltSync(timeoutMs: number = HALT_TIMEOUT_MS): Promise<void> {
  halted = true

  const inFlight = draining

  if (inFlight === null) {
    return
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      resolve(true)
    }, timeoutMs)
  })
  const late = await Promise.race([
    inFlight.then(
      () => false,
      () => false,
    ),
    timedOut,
  ])

  clearTimeout(timer)

  if (late) {
    stop.abort()
  }
}

export function markClearedHere(): void {
  clearedHere = true
}

export function resumeSync(): void {
  halted = false
  endSigningOut()

  if (clearedHere) {
    clearedHere = false
    db.syncMeta.delete(SIGNED_OUT_KEY).catch(() => undefined)
  }
}

export function sync(): Promise<SyncOutcome> {
  if (halted) {
    return Promise.resolve({ status: 'offline', pushed: 0, pulled: 0, error: null })
  }

  if (signingOutElsewhere()) {
    return Promise.resolve(idle('offline'))
  }

  draining ??= startDrain({}, null, false)

  return draining
}

export async function drainForSignOut(timeoutMs: number = HALT_TIMEOUT_MS): Promise<void> {
  if (!halted) {
    draining = startDrain({ ignoreBackoff: true }, draining, true)
  }

  await haltSync(timeoutMs)
}

let triggers: { callers: number; teardown: () => void } | null = null

function mountTriggers(): () => void {
  const tick = (): void => {
    void sync()
  }

  channel = openChannel()

  if (channel !== null) {
    channel.onmessage = hear
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
    channel?.close()
    channel = null
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
