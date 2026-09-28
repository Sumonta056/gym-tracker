import {
  DAILY_CURSOR_KEY,
  db,
  EXERCISE_CURSOR_KEY,
  LOCAL_PROFILE_ID,
  PROFILE_CURSOR_KEY,
  SESSION_CURSOR_KEY,
  SET_CURSOR_KEY,
  SIGNED_OUT_KEY,
} from '../db/dexie'
import { newId } from '../id'
import { createClient } from '../supabase/client'

import {
  ACTIVE_SESSION_ELSEWHERE,
  GLOBAL_ROW,
  isPermanent,
  MAX_ATTEMPTS,
  MAX_CONSECUTIVE_DEAD,
  moveToDeadLetters,
  readDeadStreak,
  writeDeadStreak,
} from './deadLetters'
import {
  toLocalEntry,
  toLocalExercise,
  toLocalProfile,
  toLocalSession,
  toLocalSet,
  toServerEntry,
  toServerExercise,
  toServerProfile,
  toServerSession,
  toServerSet,
} from './mappings'
import { isDue, markDone, markFailed, nextPending, syncedCount } from './outbox'

import type {
  DailyEntry,
  Exercise,
  OutboxEntry,
  OutboxTableName,
  Profile,
  WorkoutSession,
  WorkoutSet,
} from '../db/dexie'
import type { Database } from '../supabase/database.types'
import type { PostgrestSingleResponse, SupabaseClient } from '@supabase/supabase-js'
import type { Table } from 'dexie'

export const SYNC_INTERVAL_MS = 30000

export const EPOCH = new Date(0).toISOString()

export const DUPLICATE_KEY = '23505'

export const FOREIGN_KEY = '23503'

export const PARENT_NOT_SYNCED = 'PARENT_NOT_SYNCED'

export const PARENT_NOT_SYNCED_MESSAGE =
  'The session or exercise of this set has not reached the server yet.'

export const GLOBAL_ROW_MESSAGE = 'A built-in exercise is never sent to the server.'

export const ACTIVE_SESSION_MESSAGE =
  'Another device already has an active session. This one was not sent, so the other stays as it is.'

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

interface Refusal {
  message: string
  code?: string
}

interface Answer {
  data: { updated_at: string } | null
  error: Refusal | null
}

interface Stamped {
  updated_at: string
}

interface ServerRow {
  id: string
  updated_at: string
}

interface PullSpec<Row extends ServerRow> {
  tableName: OutboxTableName
  table: Table
  cursorKey: string
  fetch: (from: string) => PromiseLike<PostgrestSingleResponse<Row[]>>
  localKey: (row: Row) => string
  readLocal: (key: string) => Promise<Stamped | undefined>
  write: (row: Row) => Promise<unknown>
}

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

async function stampRow<T extends Stamped>(
  read: () => Promise<T | undefined>,
  write: (row: T) => Promise<unknown>,
  pushedAt: string,
  serverAt: string | undefined,
): Promise<void> {
  if (serverAt === undefined) {
    return
  }

  const local = await read()

  if (local === undefined || local.updated_at !== pushedAt) {
    return
  }

  await write({ ...local, updated_at: serverAt })
}

function refused(error: Refusal): SendResult {
  return { error: error.message, code: codeOf(error) }
}

async function settle(
  answer: Answer,
  stamp: (serverAt: string | undefined) => Promise<void>,
  classify: (error: Refusal) => SendResult = refused,
): Promise<SendResult> {
  if (answer.error !== null) {
    return classify(answer.error)
  }

  await stamp(answer.data?.updated_at)

  return { error: null, code: null }
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
  const answer = await untilStopped(
    client
      .from('profiles')
      .upsert(toServerProfile(payload, userId), { onConflict: 'id' })
      .select('updated_at')
      .maybeSingle(),
    signal,
  )

  return settle(answer, (serverAt) =>
    stampRow(
      () => db.profiles.get(LOCAL_PROFILE_ID),
      (row) => db.profiles.put(row),
      payload.updated_at,
      serverAt,
    ),
  )
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

    return refused(error)
  }

  await stampRow(
    () => db.dailyEntries.get(payload.id),
    (row) => db.dailyEntries.put(row),
    payload.updated_at,
    data?.updated_at,
  )

  return { error: null, code: null }
}

async function sendExercise(
  client: Client,
  payload: Exercise,
  userId: string,
  signal: AbortSignal,
): Promise<SendResult> {
  if (payload.user_id === null) {
    return { error: GLOBAL_ROW_MESSAGE, code: GLOBAL_ROW }
  }

  const answer = await untilStopped(
    client
      .from('exercises')
      .upsert(toServerExercise(payload, userId), { onConflict: 'id' })
      .select('updated_at')
      .maybeSingle(),
    signal,
  )

  return settle(answer, (serverAt) =>
    stampRow(
      () => db.exercises.get(payload.id),
      (row) => db.exercises.put(row),
      payload.updated_at,
      serverAt,
    ),
  )
}

function sessionRefusal(error: Refusal): SendResult {
  if (error.code === DUPLICATE_KEY) {
    return { error: ACTIVE_SESSION_MESSAGE, code: ACTIVE_SESSION_ELSEWHERE }
  }

  return refused(error)
}

async function sendSession(
  client: Client,
  payload: WorkoutSession,
  userId: string,
  signal: AbortSignal,
): Promise<SendResult> {
  const answer = await untilStopped(
    client
      .from('workout_sessions')
      .upsert(toServerSession(payload, userId), { onConflict: 'id' })
      .select('updated_at')
      .maybeSingle(),
    signal,
  )

  return settle(
    answer,
    (serverAt) =>
      stampRow(
        () => db.workoutSessions.get(payload.id),
        (row) => db.workoutSessions.put(row),
        payload.updated_at,
        serverAt,
      ),
    sessionRefusal,
  )
}

function setRefusal(error: Refusal): SendResult {
  if (error.code === FOREIGN_KEY) {
    return { error: PARENT_NOT_SYNCED_MESSAGE, code: PARENT_NOT_SYNCED }
  }

  return refused(error)
}

async function sendSet(
  client: Client,
  payload: WorkoutSet,
  signal: AbortSignal,
): Promise<SendResult> {
  const answer = await untilStopped(
    client
      .from('workout_sets')
      .upsert(toServerSet(payload), { onConflict: 'id' })
      .select('updated_at')
      .maybeSingle(),
    signal,
  )

  return settle(
    answer,
    (serverAt) =>
      stampRow(
        () => db.workoutSets.get(payload.id),
        (row) => db.workoutSets.put(row),
        payload.updated_at,
        serverAt,
      ),
    setRefusal,
  )
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
    return refused(error)
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
    switch (entry.table_name) {
      case 'profiles':
        return await sendProfile(client, entry.payload as Profile, userId, signal)
      case 'exercises':
        return await sendExercise(client, entry.payload as Exercise, userId, signal)
      case 'workout_sessions':
        return await sendSession(client, entry.payload as WorkoutSession, userId, signal)
      case 'workout_sets':
        return await sendSet(client, entry.payload as WorkoutSet, signal)
      case 'daily_entries':
        return await sendDailyEntry(client, entry.payload as DailyEntry, userId, true, signal)
    }
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
  let remaining = await syncedCount()
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

    entry = await nextPending(entry.sequence)
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

async function applyServerRow<Row extends ServerRow>(
  spec: PullSpec<Row>,
  row: Row,
): Promise<boolean> {
  return db.transaction('rw', spec.table, db.outbox, async () => {
    const key = spec.localKey(row)
    const queued = await db.outbox
      .where('table_name')
      .equals(spec.tableName)
      .filter((entry) => entry.row_id === key)
      .count()

    if (queued > 0) {
      return false
    }

    const local = await spec.readLocal(key)

    if (local !== undefined && row.updated_at < local.updated_at) {
      return false
    }

    await spec.write(row)

    return true
  })
}

async function pullTable<Row extends ServerRow>(
  spec: PullSpec<Row>,
  signal: AbortSignal,
): Promise<PullResult> {
  const from = await readCursor(spec.cursorKey)
  const { data, error } = await untilStopped(spec.fetch(from), signal)

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

    if (!(await applyServerRow(spec, row))) {
      blocked = true
      continue
    }

    pulled += 1

    if (!blocked && row.updated_at > highWater) {
      highWater = row.updated_at
    }
  }

  await moveCursor(spec.cursorKey, from, highWater)

  return { pulled, error: null }
}

function pullSteps(client: Client, signal: AbortSignal): (() => Promise<PullResult>)[] {
  return [
    () =>
      pullTable(
        {
          tableName: 'daily_entries',
          table: db.dailyEntries,
          cursorKey: DAILY_CURSOR_KEY,
          fetch: (from) =>
            client
              .from('daily_entries')
              .select('*')
              .gt('updated_at', from)
              .order('updated_at', { ascending: true }),
          localKey: (row) => row.id,
          readLocal: (key) => db.dailyEntries.get(key),
          write: (row) => db.dailyEntries.put(toLocalEntry(row)),
        },
        signal,
      ),
    () =>
      pullTable(
        {
          tableName: 'profiles',
          table: db.profiles,
          cursorKey: PROFILE_CURSOR_KEY,
          fetch: (from) =>
            client
              .from('profiles')
              .select('*')
              .gt('updated_at', from)
              .order('updated_at', { ascending: true }),
          localKey: () => LOCAL_PROFILE_ID,
          readLocal: (key) => db.profiles.get(key),
          write: (row) => db.profiles.put(toLocalProfile(row)),
        },
        signal,
      ),
    () =>
      pullTable(
        {
          tableName: 'exercises',
          table: db.exercises,
          cursorKey: EXERCISE_CURSOR_KEY,
          fetch: (from) =>
            client
              .from('exercises')
              .select('*')
              .gt('updated_at', from)
              .order('updated_at', { ascending: true }),
          localKey: (row) => row.id,
          readLocal: (key) => db.exercises.get(key),
          write: (row) => db.exercises.put(toLocalExercise(row)),
        },
        signal,
      ),
    () =>
      pullTable(
        {
          tableName: 'workout_sessions',
          table: db.workoutSessions,
          cursorKey: SESSION_CURSOR_KEY,
          fetch: (from) =>
            client
              .from('workout_sessions')
              .select('*')
              .gt('updated_at', from)
              .order('updated_at', { ascending: true }),
          localKey: (row) => row.id,
          readLocal: (key) => db.workoutSessions.get(key),
          write: (row) => db.workoutSessions.put(toLocalSession(row)),
        },
        signal,
      ),
    () =>
      pullTable(
        {
          tableName: 'workout_sets',
          table: db.workoutSets,
          cursorKey: SET_CURSOR_KEY,
          fetch: (from) =>
            client
              .from('workout_sets')
              .select('*')
              .gt('updated_at', from)
              .order('updated_at', { ascending: true }),
          localKey: (row) => row.id,
          readLocal: (key) => db.workoutSets.get(key),
          write: (row) => db.workoutSets.put(toLocalSet(row)),
        },
        signal,
      ),
  ]
}

export async function pull(
  client: Client,
  signal: AbortSignal = new AbortController().signal,
): Promise<PullResult> {
  let pulled = 0

  for (const step of pullSteps(client, signal)) {
    const result = await step()

    pulled += result.pulled

    if (result.error !== null) {
      return { pulled, error: result.error }
    }
  }

  return { pulled, error: null }
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
