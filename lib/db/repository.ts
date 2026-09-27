import { newId } from '../id'
import { dailyEntrySchema } from '../schema/dailyEntry'
import { exerciseSchema } from '../schema/exercise'
import { profileSchema } from '../schema/profile'
import { workoutSessionSchema } from '../schema/workoutSession'
import { workoutSetSchema } from '../schema/workoutSet'
import { append as enqueue, lastSequence } from '../sync/outbox'
import {
  endSigningOut,
  haltSync,
  LOCK_TIMEOUT_MS,
  markClearedHere,
  markSigningOut,
  resumeSync,
  withDrainLock,
} from '../sync/worker'

import { db, LOCAL_PROFILE_ID, NEVER_WRITTEN, OUTBOX_SEQUENCE_KEY, SIGNED_OUT_KEY } from './dexie'

import type { DailyEntry, Exercise, Profile, WorkoutSession, WorkoutSet } from './dexie'
import type { DailyEntryInput } from '../schema/dailyEntry'
import type { ExerciseInput, MuscleGroup } from '../schema/exercise'
import type { ProfileInput } from '../schema/profile'
import type { WorkoutSetDraft, WorkoutSetInput } from '../schema/workoutSet'

export { LOCAL_PROFILE_ID, NEVER_WRITTEN, OUTBOX_SEQUENCE_KEY } from './dexie'

export { useDeadLetters, useSyncStatus } from '../sync/useSyncStatus'

export type { SyncStatus, SyncStatusReport } from '../sync/useSyncStatus'

export {
  DrainLockBusy,
  drainForSignOut,
  haltSync,
  resumeSync,
  startSync,
  sync as syncNow,
} from '../sync/worker'

export { lastSequence as outboxSequence, pendingCount as pendingWrites } from '../sync/outbox'

export {
  deadLetterCount as failedWrites,
  discardDeadLetter,
  listDeadLetters,
  retryDeadLetter,
} from '../sync/deadLetters'

export type { SyncOutcome } from '../sync/worker'

const PROFILE_FIELDS = [
  'display_name',
  'unit_system',
  'height_cm',
  'target_weight_kg',
  'step_goal',
  'rest_sound_muted',
  'rest_seconds_by_exercise',
] as const

export class SignedOutOnThisDevice extends Error {
  constructor() {
    super('This device is signed out. Sign in again to save.')
    this.name = 'SignedOutOnThisDevice'
  }
}

export class GlobalExerciseIsReadOnly extends Error {
  constructor() {
    super('A built-in exercise cannot be changed.')
    this.name = 'GlobalExerciseIsReadOnly'
  }
}

export class ExerciseNotFound extends Error {
  constructor() {
    super('This exercise is not on this device.')
    this.name = 'ExerciseNotFound'
  }
}

export class SessionAlreadyActive extends Error {
  constructor() {
    super('A session is already running. Finish it before you start another.')
    this.name = 'SessionAlreadyActive'
  }
}

export class SessionNotFound extends Error {
  constructor() {
    super('This session is not on this device.')
    this.name = 'SessionNotFound'
  }
}

export class SetNotFound extends Error {
  constructor() {
    super('This set is not on this device.')
    this.name = 'SetNotFound'
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

async function refuseWhenSignedOut(): Promise<void> {
  if ((await db.syncMeta.get(SIGNED_OUT_KEY)) !== undefined) {
    throw new SignedOutOnThisDevice()
  }
}

function newerFirst(left: DailyEntry, right: DailyEntry): number {
  return right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)
}

function liveRow(rows: DailyEntry[]): DailyEntry | undefined {
  return rows.filter((row) => row.deleted_at === null).sort(newerFirst)[0]
}

async function rowsForDate(date: string): Promise<DailyEntry[]> {
  return db.dailyEntries.where('entry_date').equals(date).toArray()
}

async function rowForDate(date: string): Promise<DailyEntry | undefined> {
  const rows = await rowsForDate(date)

  return liveRow(rows) ?? rows[0]
}

async function keepOneLiveRow(date: string, timestamp: string): Promise<DailyEntry | undefined> {
  const rows = await rowsForDate(date)
  const winner = liveRow(rows)

  for (const row of rows) {
    if (row.deleted_at !== null || row.id === winner?.id) {
      continue
    }

    const loser: DailyEntry = { ...row, updated_at: timestamp, deleted_at: timestamp }

    await db.dailyEntries.put(loser)
    await enqueue('daily_entries', 'delete', loser)
  }

  return winner ?? rows[0]
}

export async function getDay(date: string): Promise<DailyEntry | undefined> {
  const row = await rowForDate(date)

  if (row === undefined || row.deleted_at !== null) {
    return undefined
  }

  return row
}

export async function listRange(from: string, to: string): Promise<DailyEntry[]> {
  const rows = await db.dailyEntries.where('entry_date').between(from, to, true, true).toArray()
  const winners = new Map<string, DailyEntry>()

  for (const row of rows) {
    if (row.deleted_at !== null) {
      continue
    }

    const current = winners.get(row.entry_date)

    if (current === undefined || newerFirst(row, current) < 0) {
      winners.set(row.entry_date, row)
    }
  }

  return [...winners.values()].sort((left, right) =>
    left.entry_date.localeCompare(right.entry_date),
  )
}

export async function upsertDay(input: DailyEntryInput): Promise<DailyEntry> {
  const parsed = dailyEntrySchema.parse(input)
  const timestamp = nowIso()

  return db.transaction('rw', db.dailyEntries, db.outbox, db.syncMeta, async () => {
    await refuseWhenSignedOut()

    const existing = await keepOneLiveRow(parsed.entry_date, timestamp)

    const row: DailyEntry = {
      ...parsed,
      id: existing?.id ?? newId(),
      created_at: existing?.created_at ?? timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }

    await db.dailyEntries.put(row)
    await enqueue('daily_entries', 'upsert', row)

    return row
  })
}

export async function softDeleteDay(date: string): Promise<void> {
  const timestamp = nowIso()

  await db.transaction('rw', db.dailyEntries, db.outbox, db.syncMeta, async () => {
    await refuseWhenSignedOut()

    const existing = await keepOneLiveRow(date, timestamp)

    if (existing === undefined || existing.deleted_at !== null) {
      return
    }

    const row: DailyEntry = { ...existing, updated_at: timestamp, deleted_at: timestamp }

    await db.dailyEntries.put(row)
    await enqueue('daily_entries', 'delete', row)
  })
}

function profileValues(source: Partial<Profile>): Partial<ProfileInput> {
  const values: Record<string, unknown> = {}

  for (const field of PROFILE_FIELDS) {
    if (source[field] !== undefined) {
      values[field] = source[field]
    }
  }

  return values
}

function defaultProfile(): Profile {
  return { ...profileSchema.parse({}), id: LOCAL_PROFILE_ID, updated_at: NEVER_WRITTEN }
}

export async function getProfile(): Promise<Profile> {
  const row = await db.profiles.get(LOCAL_PROFILE_ID)

  if (row !== undefined) {
    return { ...defaultProfile(), ...row }
  }

  return defaultProfile()
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const patched = profileValues(patch)

  profileSchema.partial().parse(patched)

  return db.transaction('rw', db.profiles, db.outbox, db.syncMeta, async () => {
    await refuseWhenSignedOut()

    const stored = await db.profiles.get(LOCAL_PROFILE_ID)
    const parsed = profileSchema.parse({
      ...profileValues(stored ?? defaultProfile()),
      ...patched,
    })
    const row: Profile = { ...parsed, id: LOCAL_PROFILE_ID, updated_at: nowIso() }

    await db.profiles.put(row)
    await enqueue('profiles', 'upsert', row)

    return row
  })
}

export interface ExerciseFilter {
  muscleGroup?: MuscleGroup
  query?: string
}

function searchable(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function byName(left: Exercise, right: Exercise): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
}

export async function listExercises(filter: ExerciseFilter = {}): Promise<Exercise[]> {
  const rows =
    filter.muscleGroup === undefined
      ? await db.exercises.toArray()
      : await db.exercises.where('muscle_group').equals(filter.muscleGroup).toArray()
  const query = searchable(filter.query?.trim() ?? '')

  return rows
    .filter(
      (row) => row.deleted_at === null && !row.is_archived && searchable(row.name).includes(query),
    )
    .sort(byName)
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const parsed = exerciseSchema.parse(input)
  const timestamp = nowIso()

  return db.transaction('rw', db.exercises, db.outbox, db.syncMeta, async () => {
    await refuseWhenSignedOut()

    const row: Exercise = {
      ...parsed,
      id: newId(),
      user_id: LOCAL_PROFILE_ID,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }

    await db.exercises.put(row)
    await enqueue('exercises', 'upsert', row)

    return row
  })
}

async function changeOwnExercise(id: string, patch: Partial<ExerciseInput>): Promise<Exercise> {
  return db.transaction('rw', db.exercises, db.outbox, db.syncMeta, async () => {
    await refuseWhenSignedOut()

    const existing = await db.exercises.get(id)

    if (existing === undefined || existing.deleted_at !== null) {
      throw new ExerciseNotFound()
    }

    if (existing.user_id === null) {
      throw new GlobalExerciseIsReadOnly()
    }

    const row: Exercise = { ...existing, ...patch, updated_at: nowIso() }

    await db.exercises.put(row)
    await enqueue('exercises', 'upsert', row)

    return row
  })
}

export async function renameExercise(id: string, name: string): Promise<Exercise> {
  return changeOwnExercise(id, { name: exerciseSchema.shape.name.parse(name) })
}

export async function archiveExercise(id: string): Promise<void> {
  await changeOwnExercise(id, { is_archived: true })
}

export async function restoreExercise(id: string): Promise<void> {
  await changeOwnExercise(id, { is_archived: false })
}

async function activeSessions(): Promise<WorkoutSession[]> {
  const rows = await db.workoutSessions.where('status').equals('active').toArray()

  return rows
    .filter((row) => row.deleted_at === null)
    .sort(
      (left, right) =>
        right.started_at.localeCompare(left.started_at) || left.id.localeCompare(right.id),
    )
}

async function liveSession(id: string): Promise<WorkoutSession> {
  const session = await db.workoutSessions.get(id)

  if (session === undefined || session.deleted_at !== null) {
    throw new SessionNotFound()
  }

  return session
}

async function storedSet(id: string): Promise<WorkoutSet> {
  const set = await db.workoutSets.get(id)

  if (set === undefined) {
    throw new SetNotFound()
  }

  return set
}

function setFields(set: WorkoutSet): WorkoutSetInput {
  return {
    session_id: set.session_id,
    exercise_id: set.exercise_id,
    set_index: set.set_index,
    reps: set.reps,
    weight_kg: set.weight_kg,
    rpe: set.rpe,
    completed_at: set.completed_at,
  }
}

function inWriteOrder(left: WorkoutSet, right: WorkoutSet): number {
  return (
    left.created_at.localeCompare(right.created_at) ||
    left.exercise_id.localeCompare(right.exercise_id) ||
    left.set_index - right.set_index ||
    left.id.localeCompare(right.id)
  )
}

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  return (await activeSessions())[0]
}

export async function startSession(date: string): Promise<WorkoutSession> {
  const timestamp = nowIso()
  const parsed = workoutSessionSchema.parse({
    entry_date: date,
    started_at: timestamp,
    ended_at: null,
    status: 'active',
  })

  return db.transaction('rw', db.workoutSessions, db.outbox, db.syncMeta, async () => {
    await refuseWhenSignedOut()

    if ((await activeSessions()).length > 0) {
      throw new SessionAlreadyActive()
    }

    const row: WorkoutSession = {
      ...parsed,
      id: newId(),
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }

    await db.workoutSessions.put(row)
    await enqueue('workout_sessions', 'upsert', row)

    return row
  })
}

export async function finishSession(id: string): Promise<WorkoutSession> {
  return db.transaction('rw', db.workoutSessions, db.outbox, db.syncMeta, async () => {
    await refuseWhenSignedOut()

    const session = await liveSession(id)

    if (session.status === 'finished') {
      return session
    }

    const timestamp = nowIso()
    const parsed = workoutSessionSchema.parse({
      entry_date: session.entry_date,
      started_at: session.started_at,
      ended_at: timestamp,
      status: 'finished',
    })
    const row: WorkoutSession = { ...session, ...parsed, updated_at: timestamp }

    await db.workoutSessions.put(row)
    await enqueue('workout_sessions', 'upsert', row)

    return row
  })
}

export async function discardSession(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.workoutSessions, db.workoutSets, db.outbox, db.syncMeta],
    async () => {
      await refuseWhenSignedOut()

      const session = await db.workoutSessions.get(id)

      if (session === undefined) {
        throw new SessionNotFound()
      }

      if (session.deleted_at !== null) {
        return
      }

      const timestamp = nowIso()
      const row: WorkoutSession = { ...session, updated_at: timestamp, deleted_at: timestamp }

      await db.workoutSessions.put(row)
      await enqueue('workout_sessions', 'delete', row)

      const sets = await db.workoutSets.where('session_id').equals(id).toArray()

      for (const set of sets.filter((item) => item.deleted_at === null).sort(inWriteOrder)) {
        const deleted: WorkoutSet = { ...set, updated_at: timestamp, deleted_at: timestamp }

        await db.workoutSets.put(deleted)
        await enqueue('workout_sets', 'delete', deleted)
      }
    },
  )
}

export async function addSet(input: Omit<WorkoutSetDraft, 'set_index'>): Promise<WorkoutSet> {
  return db.transaction(
    'rw',
    [db.workoutSessions, db.workoutSets, db.outbox, db.syncMeta],
    async () => {
      await refuseWhenSignedOut()
      await liveSession(input.session_id)

      const sets = await db.workoutSets.where('session_id').equals(input.session_id).toArray()
      const highest = Math.max(
        -1,
        ...sets.filter((set) => set.exercise_id === input.exercise_id).map((set) => set.set_index),
      )
      const parsed = workoutSetSchema.parse({ ...input, set_index: highest + 1 })
      const timestamp = nowIso()
      const row: WorkoutSet = {
        ...parsed,
        id: newId(),
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
      }

      await db.workoutSets.put(row)
      await enqueue('workout_sets', 'upsert', row)

      return row
    },
  )
}

export type WorkoutSetPatch = Partial<
  Pick<WorkoutSetInput, 'reps' | 'weight_kg' | 'rpe' | 'completed_at'>
>

export async function updateSet(id: string, patch: WorkoutSetPatch): Promise<WorkoutSet> {
  return db.transaction('rw', db.workoutSets, db.outbox, db.syncMeta, async () => {
    await refuseWhenSignedOut()

    const existing = await storedSet(id)

    if (existing.deleted_at !== null) {
      throw new SetNotFound()
    }

    const parsed = workoutSetSchema.parse({ ...setFields(existing), ...patch })
    const row: WorkoutSet = { ...existing, ...parsed, updated_at: nowIso() }

    await db.workoutSets.put(row)
    await enqueue('workout_sets', 'upsert', row)

    return row
  })
}

export async function deleteSet(id: string): Promise<void> {
  await db.transaction('rw', db.workoutSets, db.outbox, db.syncMeta, async () => {
    await refuseWhenSignedOut()

    const existing = await storedSet(id)

    if (existing.deleted_at !== null) {
      return
    }

    const timestamp = nowIso()
    const row: WorkoutSet = { ...existing, updated_at: timestamp, deleted_at: timestamp }

    await db.workoutSets.put(row)
    await enqueue('workout_sets', 'delete', row)
  })
}

export async function restoreSet(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.workoutSessions, db.workoutSets, db.outbox, db.syncMeta],
    async () => {
      await refuseWhenSignedOut()

      const existing = await storedSet(id)

      if (existing.deleted_at === null) {
        return
      }

      await liveSession(existing.session_id)

      const row: WorkoutSet = { ...existing, updated_at: nowIso(), deleted_at: null }

      await db.workoutSets.put(row)
      await enqueue('workout_sets', 'upsert', row)
    },
  )
}

export async function listSets(sessionId: string): Promise<WorkoutSet[]> {
  const rows = await db.workoutSets.where('session_id').equals(sessionId).toArray()

  return rows.filter((row) => row.deleted_at === null).sort(inWriteOrder)
}

export async function lastSetFor(exerciseId: string): Promise<WorkoutSet | undefined> {
  const rows = await db.workoutSets
    .filter((row) => row.exercise_id === exerciseId && row.deleted_at === null)
    .toArray()

  return rows.sort((left, right) => inWriteOrder(right, left))[0]
}

export interface ConfirmedWrites {
  count: number
  sequence: number
}

export class UnsyncedWritesChanged extends Error {
  constructor(
    readonly count: number,
    readonly sequence: number,
  ) {
    super(`${String(count)} unsynced writes wait on this device`)
    this.name = 'UnsyncedWritesChanged'
  }
}

export async function clearAll<T>(
  confirmed: ConfirmedWrites,
  endSession: () => Promise<T>,
): Promise<T> {
  await haltSync()
  markSigningOut()

  try {
    return await withDrainLock(async () => {
      await db.transaction(
        'rw',
        [
          db.dailyEntries,
          db.profiles,
          db.outbox,
          db.deadLetters,
          db.syncMeta,
          db.exercises,
          db.workoutSessions,
          db.workoutSets,
        ],
        async () => {
          const count = (await db.outbox.count()) + (await db.deadLetters.count())
          const sequence = await lastSequence()

          if (count > confirmed.count || sequence > confirmed.sequence) {
            throw new UnsyncedWritesChanged(count, sequence)
          }

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
          await db.syncMeta.bulkPut([
            { key: OUTBOX_SEQUENCE_KEY, value: String(sequence) },
            { key: SIGNED_OUT_KEY, value: nowIso() },
          ])
        },
      )

      markClearedHere()

      const ended = await endSession()

      endSigningOut()

      return ended
    }, LOCK_TIMEOUT_MS)
  } catch (cause) {
    if (cause instanceof UnsyncedWritesChanged) {
      endSigningOut()
    } else {
      resumeSync()
    }

    throw cause
  }
}
