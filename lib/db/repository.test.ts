import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dailyEntrySchema, localDate } from '../schema/dailyEntry'
import { moveToDeadLetters } from '../sync/deadLetters'
import { resumeSync, SIGN_OUT_MARKER } from '../sync/worker'

import { db, SIGNED_OUT_KEY } from './dexie'
import {
  archiveExercise,
  clearAll,
  addSet,
  createExercise,
  deleteSet,
  discardDeadLetter,
  discardSession,
  finishSession,
  getActiveSession,
  lastSetFor,
  lastSetsFor,
  listSets,
  setsForExercises,
  restoreSet,
  SessionAlreadyActive,
  SessionNotFound,
  SetNotFound,
  startSession,
  updateSet,
  ExerciseNotFound,
  GlobalExerciseIsReadOnly,
  listExercises,
  renameExercise,
  restoreExercise,
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
  setRestSeconds,
  SignedOutOnThisDevice,
  softDeleteDay,
  syncNow,
  updateProfile,
  UnsyncedWritesChanged,
  upsertDay,
} from './repository'

import type { DailyEntry, Exercise, OutboxEntry, WorkoutSet } from './dexie'
import type { DailyEntryInput } from '../schema/dailyEntry'
import type { MuscleGroup } from '../schema/exercise'
import type { WorkoutSetDraft } from '../schema/workoutSet'

vi.mock('../supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a unit test')
  },
}))

const REST_EXERCISE_ID = '22222222-2222-4222-8222-222222222222'
const BENCH_ID = '33333333-3333-4333-8333-333333333333'
const SQUAT_ID = '44444444-4444-4444-8444-444444444444'
const DEVELOPPE_ID = '55555555-5555-4555-8555-555555555555'

function globalExercise(id: string, name: string, muscleGroup: MuscleGroup): Exercise {
  return {
    id,
    user_id: null,
    name,
    muscle_group: muscleGroup,
    is_archived: false,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    deleted_at: null,
  }
}

async function seedGlobals(): Promise<void> {
  await db.exercises.bulkPut([
    globalExercise(BENCH_ID, 'Bench Press', 'chest'),
    globalExercise(SQUAT_ID, 'Back Squat', 'legs'),
    globalExercise(DEVELOPPE_ID, 'Développé Couché', 'chest'),
  ])
}

async function refusal(write: Promise<unknown>): Promise<unknown> {
  return write.then(
    () => null,
    (cause: unknown) => cause,
  )
}

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
    db.exercises.clear(),
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
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
      rest_sound_muted: false,
      rest_seconds_by_exercise: {},
    })
  })

  it('fills the rest settings of a row stored before they existed', async () => {
    await db.profiles.put({
      id: LOCAL_PROFILE_ID,
      updated_at: '2026-09-01T00:00:00.000Z',
      display_name: 'Sumonta',
      unit_system: 'metric',
      height_cm: null,
      target_weight_kg: null,
      step_goal: 9000,
    })

    const profile = await getProfile()

    expect(profile.rest_sound_muted).toBe(false)
    expect(profile.rest_seconds_by_exercise).toEqual({})
    expect(profile.step_goal).toBe(9000)
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

  it('saves the rest settings the patch carries', async () => {
    const saved = await updateProfile({
      rest_sound_muted: true,
      rest_seconds_by_exercise: { [REST_EXERCISE_ID]: 90 },
    })

    expect(saved.rest_sound_muted).toBe(true)
    expect(saved.rest_seconds_by_exercise).toEqual({ [REST_EXERCISE_ID]: 90 })
  })

  it('keeps the stored rest settings when the patch changes another field', async () => {
    await updateProfile({
      rest_sound_muted: true,
      rest_seconds_by_exercise: { [REST_EXERCISE_ID]: 90 },
    })
    const second = await updateProfile({ step_goal: 9000 })

    expect(second.rest_sound_muted).toBe(true)
    expect(second.rest_seconds_by_exercise).toEqual({ [REST_EXERCISE_ID]: 90 })
  })

  it('rejects a patch that fails the zod schema', async () => {
    await expect(updateProfile({ step_goal: 0 })).rejects.toThrow()

    expect(await db.profiles.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('setRestSeconds', () => {
  const OTHER_ID = '55555555-5555-4555-8555-555555555555'

  it('saves the rest for one exercise with one outbox entry', async () => {
    const saved = await setRestSeconds(REST_EXERCISE_ID, 120)
    const queued = await db.outbox.toArray()

    expect(saved.rest_seconds_by_exercise).toEqual({ [REST_EXERCISE_ID]: 120 })
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ table_name: 'profiles', operation: 'upsert' })
    expect(queued[0]?.payload).toEqual(saved)
  })

  it('keeps the rest of every other exercise', async () => {
    await updateProfile({ rest_seconds_by_exercise: { [OTHER_ID]: 60 } })
    const saved = await setRestSeconds(REST_EXERCISE_ID, 150)

    expect(saved.rest_seconds_by_exercise).toEqual({ [OTHER_ID]: 60, [REST_EXERCISE_ID]: 150 })
  })

  it('keeps both exercises when two changes overlap', async () => {
    await Promise.all([setRestSeconds(REST_EXERCISE_ID, 150), setRestSeconds(OTHER_ID, 45)])

    expect((await getProfile()).rest_seconds_by_exercise).toEqual({
      [REST_EXERCISE_ID]: 150,
      [OTHER_ID]: 45,
    })
  })

  it('keeps the other profile fields', async () => {
    await updateProfile({ display_name: 'Sumonta', rest_sound_muted: true })
    const saved = await setRestSeconds(REST_EXERCISE_ID, 90)

    expect(saved.display_name).toBe('Sumonta')
    expect(saved.rest_sound_muted).toBe(true)
  })

  it('rejects a rest above the limit and stores nothing', async () => {
    await expect(setRestSeconds(REST_EXERCISE_ID, 3601)).rejects.toThrow()

    expect(await db.profiles.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('refuses on a signed-out device and stores nothing', async () => {
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-09-02T00:00:00.000Z' })

    await expect(setRestSeconds(REST_EXERCISE_ID, 120)).rejects.toBeInstanceOf(
      SignedOutOnThisDevice,
    )
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

describe('listExercises', () => {
  it('returns the global rows and the own rows, sorted by name', async () => {
    await seedGlobals()
    const own = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })

    const names = (await listExercises()).map((row) => row.name)

    expect(names).toEqual(['Back Squat', 'Bench Press', 'Cable Fly', 'Développé Couché'])
    expect((await listExercises()).find((row) => row.id === own.id)?.user_id).toBe(LOCAL_PROFILE_ID)
  })

  it('finds Bench Press for the query bench', async () => {
    await seedGlobals()

    const found = await listExercises({ query: 'bench' })

    expect(found.map((row) => row.name)).toEqual(['Bench Press'])
  })

  it('finds Bench Press for the query BÉNCH, ignoring case and accents', async () => {
    await seedGlobals()

    const found = await listExercises({ query: 'BÉNCH' })

    expect(found.map((row) => row.name)).toEqual(['Bench Press'])
  })

  it('finds an accented name from a plain query', async () => {
    await seedGlobals()

    const found = await listExercises({ query: 'developpe' })

    expect(found.map((row) => row.name)).toEqual(['Développé Couché'])
  })

  it('treats a blank query as no filter', async () => {
    await seedGlobals()

    expect(await listExercises({ query: '   ' })).toHaveLength(3)
  })

  it('keeps only the muscle group it is given', async () => {
    await seedGlobals()

    const found = await listExercises({ muscleGroup: 'legs' })

    expect(found.map((row) => row.name)).toEqual(['Back Squat'])
  })

  it('applies the muscle group and the query together', async () => {
    await seedGlobals()

    const found = await listExercises({ muscleGroup: 'chest', query: 'couché' })

    expect(found.map((row) => row.name)).toEqual(['Développé Couché'])
  })

  it('orders two rows with the same name by id, so the list never shuffles', async () => {
    await db.exercises.bulkPut([
      globalExercise(SQUAT_ID, 'Bench Press', 'chest'),
      globalExercise(BENCH_ID, 'Bench Press', 'chest'),
    ])

    expect((await listExercises()).map((row) => row.id)).toEqual([BENCH_ID, SQUAT_ID])
  })

  it('hides a soft-deleted row', async () => {
    await db.exercises.put({
      ...globalExercise(BENCH_ID, 'Bench Press', 'chest'),
      deleted_at: '2026-09-02T00:00:00.000Z',
    })

    expect(await listExercises()).toEqual([])
  })

  it('hides an archived row by default', async () => {
    const own = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })
    await archiveExercise(own.id)

    expect(await listExercises()).toEqual([])
  })

  it('returns an archived row when includeArchived is true', async () => {
    const own = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })
    await archiveExercise(own.id)

    const found = await listExercises({ includeArchived: true })

    expect(found.map((row) => [row.id, row.is_archived])).toEqual([[own.id, true]])
  })

  it('still hides a soft-deleted row when includeArchived is true', async () => {
    await db.exercises.put({
      ...globalExercise(BENCH_ID, 'Bench Press', 'chest'),
      is_archived: true,
      deleted_at: '2026-09-02T00:00:00.000Z',
    })

    expect(await listExercises({ includeArchived: true })).toEqual([])
  })
})

describe('createExercise', () => {
  it('writes the row and one outbox entry in one transaction', async () => {
    const created = await createExercise({
      name: '  Cable Fly  ',
      muscle_group: 'chest',
      is_archived: false,
    })
    const queued = await db.outbox.toArray()

    expect(await db.exercises.get(created.id)).toEqual(created)
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({
      table_name: 'exercises',
      operation: 'upsert',
      row_id: created.id,
      payload: created,
    })
  })

  it('stores an own row under the local profile id with a client uuid', async () => {
    const created = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })

    expect(created).toMatchObject({
      name: 'Cable Fly',
      user_id: LOCAL_PROFILE_ID,
      is_archived: false,
      deleted_at: null,
    })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.created_at).toBe(created.updated_at)
  })

  it('rolls back the row when its outbox entry fails', async () => {
    const append = db.outbox.add.bind(db.outbox)
    vi.spyOn(db.outbox, 'add').mockImplementation((item) =>
      append(item).then(() => {
        throw new Error('the outbox is full')
      }),
    )

    await expect(
      createExercise({ name: 'Cable Fly', muscle_group: 'chest', is_archived: false }),
    ).rejects.toThrow('the outbox is full')

    vi.restoreAllMocks()

    expect(await db.exercises.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('rejects an input that fails the schema and writes nothing', async () => {
    await expect(
      createExercise({ name: '', muscle_group: 'chest', is_archived: false }),
    ).rejects.toThrow()

    expect(await db.exercises.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('renameExercise', () => {
  it('renames an own row and queues one outbox entry for it', async () => {
    const created = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })

    const renamed = await renameExercise(created.id, '  Low Cable Fly ')

    expect(renamed.name).toBe('Low Cable Fly')
    expect(renamed.id).toBe(created.id)
    expect(await db.exercises.get(created.id)).toEqual(renamed)
    expect((await db.outbox.orderBy('sequence').last())?.payload).toEqual(renamed)
    expect(await db.outbox.count()).toBe(2)
  })

  it('rejects an empty name and writes nothing', async () => {
    const created = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })

    await expect(renameExercise(created.id, '  ')).rejects.toThrow()

    expect((await db.exercises.get(created.id))?.name).toBe('Cable Fly')
    expect(await db.outbox.count()).toBe(1)
  })

  it('throws ExerciseNotFound for an id the device does not hold', async () => {
    const cause = await refusal(renameExercise(BENCH_ID, 'Bench'))

    expect(cause).toBeInstanceOf(ExerciseNotFound)
    expect(await db.outbox.count()).toBe(0)
  })

  it('throws ExerciseNotFound for a soft-deleted row', async () => {
    const created = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })
    await db.exercises.put({ ...created, deleted_at: '2026-09-02T00:00:00.000Z' })

    expect(await refusal(renameExercise(created.id, 'Fly'))).toBeInstanceOf(ExerciseNotFound)
  })
})

describe('archiveExercise and restoreExercise', () => {
  it('hides an archived row from listExercises and shows it again once restored', async () => {
    const created = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })

    await archiveExercise(created.id)
    const whileArchived = await listExercises()
    await restoreExercise(created.id)
    const afterRestore = await listExercises()

    expect(whileArchived).toEqual([])
    expect(afterRestore.map((row) => row.id)).toEqual([created.id])
    expect(afterRestore[0]?.is_archived).toBe(false)
  })

  it('queues one upsert for the archive and one for the restore', async () => {
    const created = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })

    await archiveExercise(created.id)
    await restoreExercise(created.id)
    const queued = await db.outbox.orderBy('sequence').toArray()

    expect(queued.map((item) => [item.operation, (item.payload as Exercise).is_archived])).toEqual([
      ['upsert', false],
      ['upsert', true],
      ['upsert', false],
    ])
  })

  it('keeps the archived row on the device, as a soft change', async () => {
    const created = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })

    await archiveExercise(created.id)

    expect(await db.exercises.get(created.id)).toMatchObject({
      is_archived: true,
      deleted_at: null,
    })
  })
})

describe('a write to a global exercise', () => {
  it('throws GlobalExerciseIsReadOnly and writes no outbox entry', async () => {
    await seedGlobals()
    const before = await db.exercises.toArray()

    const refusals = [
      await refusal(renameExercise(BENCH_ID, 'My Bench')),
      await refusal(archiveExercise(BENCH_ID)),
      await refusal(restoreExercise(BENCH_ID)),
    ]

    expect(refusals.every((cause) => cause instanceof GlobalExerciseIsReadOnly)).toBe(true)
    expect(refusals[0]).toMatchObject({
      name: 'GlobalExerciseIsReadOnly',
      message: 'A built-in exercise cannot be changed.',
    })
    expect(await db.outbox.count()).toBe(0)
    expect(await db.exercises.toArray()).toEqual(before)
  })
})

describe('an exercise write on a signed-out device', () => {
  it('throws SignedOutOnThisDevice and stores nothing', async () => {
    const created = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-09-02T00:00:00.000Z' })
    const before = await db.exercises.toArray()

    const refusals = [
      await refusal(createExercise({ name: 'Dip', muscle_group: 'arms', is_archived: false })),
      await refusal(renameExercise(created.id, 'Fly')),
      await refusal(archiveExercise(created.id)),
      await refusal(restoreExercise(created.id)),
    ]

    expect(refusals.every((cause) => cause instanceof SignedOutOnThisDevice)).toBe(true)
    expect(await db.exercises.toArray()).toEqual(before)
    expect(await db.outbox.count()).toBe(1)
  })
})

function aSet(
  sessionId: string,
  overrides: Partial<WorkoutSetDraft> = {},
): Omit<WorkoutSetDraft, 'set_index'> {
  return { session_id: sessionId, exercise_id: BENCH_ID, reps: 8, weight_kg: 60, ...overrides }
}

async function queuedInOrder(): Promise<OutboxEntry[]> {
  return db.outbox.orderBy('sequence').toArray()
}

function storedSet(overrides: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    exercise_id: BENCH_ID,
    set_index: 0,
    reps: 5,
    weight_kg: 100,
    rpe: null,
    completed_at: null,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

describe('startSession', () => {
  it('starts an active session now and queues one upsert for it', async () => {
    const before = Date.now()

    const session = await startSession('2026-09-01')
    const queued = await queuedInOrder()

    expect(session).toMatchObject({
      entry_date: '2026-09-01',
      status: 'active',
      ended_at: null,
      deleted_at: null,
    })
    expect(Date.parse(session.started_at)).toBeGreaterThanOrEqual(before)
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await db.workoutSessions.get(session.id)).toEqual(session)
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({
      table_name: 'workout_sessions',
      operation: 'upsert',
      row_id: session.id,
      payload: session,
    })
  })

  it('throws SessionAlreadyActive when a session is already active', async () => {
    const active = await startSession('2026-09-01')

    const cause = await refusal(startSession('2026-09-02'))

    expect(cause).toBeInstanceOf(SessionAlreadyActive)
    expect(cause).toMatchObject({ name: 'SessionAlreadyActive' })
    expect((await db.workoutSessions.toArray()).map((row) => row.id)).toEqual([active.id])
    expect(await db.outbox.count()).toBe(1)
  })

  it('starts a new session once the active one is finished', async () => {
    const first = await startSession('2026-09-01')
    await finishSession(first.id)

    const second = await startSession('2026-09-02')

    expect(await getActiveSession()).toEqual(second)
  })

  it('rejects a date in the future and writes nothing', async () => {
    await expect(startSession('2999-01-01')).rejects.toThrow()

    expect(await db.workoutSessions.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('getActiveSession', () => {
  it('returns undefined when no session is active', async () => {
    expect(await getActiveSession()).toBeUndefined()
  })

  it('returns the active session and skips a finished or discarded one', async () => {
    const finished = await startSession('2026-09-01')
    await finishSession(finished.id)
    const discarded = await startSession('2026-09-02')
    await discardSession(discarded.id)
    const active = await startSession('2026-09-03')

    expect(await getActiveSession()).toEqual(active)
  })
  it('returns the newest when two active sessions reach the device', async () => {
    const older = await startSession('2026-09-01')
    const newer = {
      ...older,
      id: crypto.randomUUID(),
      started_at: new Date(Date.parse(older.started_at) + 1000).toISOString(),
    }
    await db.workoutSessions.put(newer)

    expect(await getActiveSession()).toEqual(newer)
  })

  it('leaves the older active session active and untouched', async () => {
    const older = await startSession('2026-09-01')
    await db.outbox.clear()
    await db.workoutSessions.put({
      ...older,
      id: crypto.randomUUID(),
      started_at: new Date(Date.parse(older.started_at) + 1000).toISOString(),
    })

    await getActiveSession()

    expect(await db.workoutSessions.get(older.id)).toEqual(older)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('finishSession', () => {
  it('sets ended_at and the finished status, and queues one upsert', async () => {
    const session = await startSession('2026-09-01')

    const finished = await finishSession(session.id)
    const queued = await queuedInOrder()

    expect(finished).toMatchObject({ id: session.id, status: 'finished' })
    expect(Date.parse(finished.ended_at ?? '')).toBeGreaterThanOrEqual(
      Date.parse(session.started_at),
    )
    expect(await db.workoutSessions.get(session.id)).toEqual(finished)
    expect(queued).toHaveLength(2)
    expect(queued[1]).toMatchObject({ operation: 'upsert', payload: finished })
    expect(await getActiveSession()).toBeUndefined()
  })

  it('returns a finished session unchanged and queues nothing more', async () => {
    const session = await startSession('2026-09-01')
    const finished = await finishSession(session.id)

    expect(await finishSession(session.id)).toEqual(finished)
    expect(await db.outbox.count()).toBe(2)
  })

  it('throws SessionNotFound for a session the device does not hold', async () => {
    const cause = await refusal(finishSession(crypto.randomUUID()))

    expect(cause).toBeInstanceOf(SessionNotFound)
    expect(await db.outbox.count()).toBe(0)
  })

  it('throws SessionNotFound for a discarded session', async () => {
    const session = await startSession('2026-09-01')
    await discardSession(session.id)

    expect(await refusal(finishSession(session.id))).toBeInstanceOf(SessionNotFound)
  })

  it('finishes a session whose start is ahead of this device clock', async () => {
    const session = await startSession('2026-09-01')
    const ahead = { ...session, started_at: new Date(Date.now() + 5000).toISOString() }
    await db.workoutSessions.put(ahead)

    const finished = await finishSession(session.id)

    expect(finished).toMatchObject({ id: session.id, status: 'finished' })
    expect(Date.parse(finished.ended_at ?? '')).toBeGreaterThanOrEqual(Date.parse(ahead.started_at))
    expect(await db.workoutSessions.get(session.id)).toEqual(finished)
  })

  it('finishes a session whose date is ahead of this device date', async () => {
    const session = await startSession('2026-09-01')
    const later = new Date()
    later.setDate(later.getDate() + 2)
    const ahead = { ...session, entry_date: localDate(later) }
    await db.workoutSessions.put(ahead)

    const finished = await finishSession(session.id)

    expect(finished).toMatchObject({
      id: session.id,
      entry_date: ahead.entry_date,
      status: 'finished',
    })
    expect(await db.workoutSessions.get(session.id)).toEqual(finished)
  })
})

describe('addSet', () => {
  it('queues the session and the set, the session first', async () => {
    const session = await startSession('2026-09-01')
    const set = await addSet(aSet(session.id))
    const queued = await db.outbox.toArray()
    const sessionEntry = queued.find((item) => item.row_id === session.id)
    const setEntry = queued.find((item) => item.row_id === set.id)

    expect(queued).toHaveLength(2)
    expect(sessionEntry).toMatchObject({ table_name: 'workout_sessions', operation: 'upsert' })
    expect(setEntry).toMatchObject({
      table_name: 'workout_sets',
      operation: 'upsert',
      payload: set,
    })
    expect(sessionEntry?.sequence).toBeLessThan(setEntry?.sequence ?? 0)
  })

  it('stores the set with a client uuid and the schema defaults', async () => {
    const session = await startSession('2026-09-01')

    const set = await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 10 })

    expect(set).toMatchObject({
      session_id: session.id,
      exercise_id: BENCH_ID,
      set_index: 0,
      reps: 10,
      weight_kg: null,
      rpe: null,
      completed_at: null,
      deleted_at: null,
    })
    expect(set.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await db.workoutSets.get(set.id)).toEqual(set)
  })

  it('gives the next set_index for that exercise in that session', async () => {
    const session = await startSession('2026-09-01')

    const indexes = [
      (await addSet(aSet(session.id))).set_index,
      (await addSet(aSet(session.id))).set_index,
      (await addSet(aSet(session.id, { exercise_id: SQUAT_ID }))).set_index,
      (await addSet(aSet(session.id))).set_index,
    ]

    expect(indexes).toEqual([0, 1, 0, 2])
  })

  it('never repeats a set_index after a delete', async () => {
    const session = await startSession('2026-09-01')
    await addSet(aSet(session.id))
    const last = await addSet(aSet(session.id))
    await deleteSet(last.id)

    const next = await addSet(aSet(session.id))

    expect(next.set_index).toBe(2)
  })

  it('counts the set_index per session, not across sessions', async () => {
    const first = await startSession('2026-09-01')
    await addSet(aSet(first.id))
    await finishSession(first.id)
    const second = await startSession('2026-09-02')

    expect((await addSet(aSet(second.id))).set_index).toBe(0)
  })

  it('throws SessionNotFound for a discarded session and writes nothing', async () => {
    const session = await startSession('2026-09-01')
    await discardSession(session.id)
    const queued = await db.outbox.count()

    expect(await refusal(addSet(aSet(session.id)))).toBeInstanceOf(SessionNotFound)
    expect(await db.workoutSets.count()).toBe(0)
    expect(await db.outbox.count()).toBe(queued)
  })

  it('rejects a set that fails the schema and writes nothing', async () => {
    const session = await startSession('2026-09-01')

    await expect(addSet(aSet(session.id, { reps: 0 }))).rejects.toThrow()

    expect(await db.workoutSets.count()).toBe(0)
    expect(await db.outbox.count()).toBe(1)
  })

  it('rolls back the set when its outbox entry fails', async () => {
    const session = await startSession('2026-09-01')
    const append = db.outbox.add.bind(db.outbox)
    vi.spyOn(db.outbox, 'add').mockImplementation((item) =>
      append(item).then(() => {
        throw new Error('the outbox is full')
      }),
    )

    await expect(addSet(aSet(session.id))).rejects.toThrow('the outbox is full')

    vi.restoreAllMocks()

    expect(await db.workoutSets.count()).toBe(0)
    expect(await db.outbox.count()).toBe(1)
  })
})

describe('updateSet', () => {
  it('patches the set and queues one upsert for it', async () => {
    const session = await startSession('2026-09-01')
    const set = await addSet(aSet(session.id))

    const updated = await updateSet(set.id, { reps: 12, weight_kg: 62.5 })
    const queued = await queuedInOrder()

    expect(updated).toMatchObject({ id: set.id, reps: 12, weight_kg: 62.5, set_index: 0 })
    expect(updated.created_at).toBe(set.created_at)
    expect(await db.workoutSets.get(set.id)).toEqual(updated)
    expect(queued).toHaveLength(3)
    expect(queued[2]).toMatchObject({ operation: 'upsert', row_id: set.id, payload: updated })
  })

  it('rejects a patch that fails the schema and keeps the set', async () => {
    const session = await startSession('2026-09-01')
    const set = await addSet(aSet(session.id))

    await expect(updateSet(set.id, { reps: 0 })).rejects.toThrow()

    expect(await db.workoutSets.get(set.id)).toEqual(set)
    expect(await db.outbox.count()).toBe(2)
  })

  it('throws SetNotFound for a deleted set', async () => {
    const session = await startSession('2026-09-01')
    const set = await addSet(aSet(session.id))
    await deleteSet(set.id)

    expect(await refusal(updateSet(set.id, { reps: 9 }))).toBeInstanceOf(SetNotFound)
  })
})

describe('deleteSet', () => {
  it('soft deletes and queues one entry, and listSets then hides the set', async () => {
    const session = await startSession('2026-09-01')
    const kept = await addSet(aSet(session.id))
    const removed = await addSet(aSet(session.id))
    const before = await db.outbox.count()

    await deleteSet(removed.id)
    const queued = await queuedInOrder()
    const stored = await db.workoutSets.get(removed.id)

    expect(stored?.deleted_at).not.toBeNull()
    expect(stored?.updated_at).toBe(stored?.deleted_at)
    expect(queued).toHaveLength(before + 1)
    expect(queued[before]).toMatchObject({
      table_name: 'workout_sets',
      operation: 'delete',
      row_id: removed.id,
      payload: stored,
    })
    expect((await listSets(session.id)).map((row) => row.id)).toEqual([kept.id])
  })

  it('queues nothing for a set that is already deleted', async () => {
    const session = await startSession('2026-09-01')
    const set = await addSet(aSet(session.id))
    await deleteSet(set.id)
    const before = await db.outbox.count()

    await deleteSet(set.id)

    expect(await db.outbox.count()).toBe(before)
  })

  it('throws SetNotFound for a set the device does not hold', async () => {
    expect(await refusal(deleteSet(crypto.randomUUID()))).toBeInstanceOf(SetNotFound)
  })
})

describe('restoreSet', () => {
  it('brings the set back and queues one entry', async () => {
    const session = await startSession('2026-09-01')
    const set = await addSet(aSet(session.id))
    await deleteSet(set.id)
    const before = await db.outbox.count()

    await restoreSet(set.id)
    const queued = await queuedInOrder()
    const stored = await db.workoutSets.get(set.id)

    expect(stored).toMatchObject({ id: set.id, set_index: 0, deleted_at: null })
    expect(queued).toHaveLength(before + 1)
    expect(queued[before]).toMatchObject({
      table_name: 'workout_sets',
      operation: 'upsert',
      row_id: set.id,
      payload: stored,
    })
    expect((await listSets(session.id)).map((row) => row.id)).toEqual([set.id])
  })

  it('queues nothing for a set that is not deleted', async () => {
    const session = await startSession('2026-09-01')
    const set = await addSet(aSet(session.id))

    await restoreSet(set.id)

    expect(await db.outbox.count()).toBe(2)
  })

  it('throws SetNotFound for a set the device does not hold', async () => {
    expect(await refusal(restoreSet(crypto.randomUUID()))).toBeInstanceOf(SetNotFound)
  })

  it('throws SessionNotFound for a set of a discarded session', async () => {
    const session = await startSession('2026-09-01')
    const set = await addSet(aSet(session.id))
    await discardSession(session.id)
    const before = await db.outbox.count()

    expect(await refusal(restoreSet(set.id))).toBeInstanceOf(SessionNotFound)
    expect((await db.workoutSets.get(set.id))?.deleted_at).not.toBeNull()
    expect(await db.outbox.count()).toBe(before)
  })
})

describe('discardSession', () => {
  it('soft deletes the session and all its sets in one transaction', async () => {
    const session = await startSession('2026-09-01')
    const sets = [
      await addSet(aSet(session.id)),
      await addSet(aSet(session.id, { exercise_id: SQUAT_ID })),
    ]
    await deleteSet(sets[0]?.id ?? '')
    const before = await db.outbox.count()

    await discardSession(session.id)
    const discarded = await db.workoutSessions.get(session.id)
    const stored = await db.workoutSets.where('session_id').equals(session.id).toArray()
    const added = (await queuedInOrder()).slice(before)

    expect(discarded?.deleted_at).not.toBeNull()
    expect(stored.every((row) => row.deleted_at !== null)).toBe(true)
    expect(added.map((item) => [item.table_name, item.operation, item.row_id])).toEqual([
      ['workout_sessions', 'delete', session.id],
      ['workout_sets', 'delete', sets[1]?.id],
    ])
    expect(await getActiveSession()).toBeUndefined()
    expect(await listSets(session.id)).toEqual([])
  })

  it('changes nothing when one of its writes fails', async () => {
    const session = await startSession('2026-09-01')
    await addSet(aSet(session.id))
    await addSet(aSet(session.id))
    const sessionsBefore = await db.workoutSessions.toArray()
    const setsBefore = await db.workoutSets.toArray()
    const append = db.outbox.add.bind(db.outbox)
    let calls = 0
    vi.spyOn(db.outbox, 'add').mockImplementation((item) =>
      append(item).then((key) => {
        calls += 1

        if (calls === 3) {
          throw new Error('the outbox is full')
        }

        return key
      }),
    )

    await expect(discardSession(session.id)).rejects.toThrow('the outbox is full')

    vi.restoreAllMocks()

    expect(await db.workoutSessions.toArray()).toEqual(sessionsBefore)
    expect(await db.workoutSets.toArray()).toEqual(setsBefore)
    expect(await db.outbox.count()).toBe(3)
  })

  it('queues nothing for a session that is already discarded', async () => {
    const session = await startSession('2026-09-01')
    await discardSession(session.id)
    const before = await db.outbox.count()

    await discardSession(session.id)

    expect(await db.outbox.count()).toBe(before)
  })

  it('throws SessionNotFound for a session the device does not hold', async () => {
    expect(await refusal(discardSession(crypto.randomUUID()))).toBeInstanceOf(SessionNotFound)
  })
})

describe('listSets', () => {
  it('returns the live sets of one session, oldest first', async () => {
    await db.workoutSets.bulkPut([
      storedSet({
        id: '00000000-0000-4000-8000-000000000003',
        session_id: SQUAT_ID,
        created_at: '2026-09-01T10:02:00.000Z',
      }),
      storedSet({
        id: '00000000-0000-4000-8000-000000000001',
        session_id: SQUAT_ID,
        created_at: '2026-09-01T10:00:00.000Z',
      }),
      storedSet({
        id: '00000000-0000-4000-8000-000000000002',
        session_id: SQUAT_ID,
        created_at: '2026-09-01T10:01:00.000Z',
      }),
      storedSet({ id: '00000000-0000-4000-8000-000000000004', session_id: BENCH_ID }),
      storedSet({
        id: '00000000-0000-4000-8000-000000000005',
        session_id: SQUAT_ID,
        deleted_at: '2026-09-01T11:00:00.000Z',
      }),
    ])

    expect((await listSets(SQUAT_ID)).map((row) => row.id.slice(-1))).toEqual(['1', '2', '3'])
  })

  it('orders sets written in the same millisecond by exercise and set_index', async () => {
    await db.workoutSets.bulkPut([
      storedSet({ id: '00000000-0000-4000-8000-000000000001', session_id: SQUAT_ID, set_index: 1 }),
      storedSet({ id: '00000000-0000-4000-8000-000000000002', session_id: SQUAT_ID, set_index: 0 }),
    ])

    expect((await listSets(SQUAT_ID)).map((row) => row.set_index)).toEqual([0, 1])
  })
})

describe('lastSetFor', () => {
  it('returns undefined for an exercise with no set', async () => {
    expect(await lastSetFor(BENCH_ID)).toBeUndefined()
  })

  it('returns the newest set of the exercise across all sessions', async () => {
    const newest = storedSet({ created_at: '2026-09-03T10:00:00.000Z', reps: 3 })
    await db.workoutSets.bulkPut([
      storedSet({ created_at: '2026-09-01T10:00:00.000Z' }),
      newest,
      storedSet({ created_at: '2026-09-02T10:00:00.000Z' }),
      storedSet({ exercise_id: SQUAT_ID, created_at: '2026-09-04T10:00:00.000Z' }),
    ])

    expect(await lastSetFor(BENCH_ID)).toEqual(newest)
  })

  it('takes the higher set_index when two sets share a timestamp', async () => {
    const later = storedSet({ set_index: 1 })
    await db.workoutSets.bulkPut([storedSet({ set_index: 0 }), later])

    expect(await lastSetFor(BENCH_ID)).toEqual(later)
  })

  it('skips a soft-deleted set', async () => {
    const session = await startSession('2026-09-01')
    const kept = await addSet(aSet(session.id, { reps: 5 }))
    const removed = await addSet(aSet(session.id, { reps: 6 }))
    await deleteSet(removed.id)

    expect(await lastSetFor(BENCH_ID)).toEqual(kept)
  })

  it('picks the set completed last, even when it was written first', async () => {
    const completedLast = storedSet({
      created_at: '2026-09-01T10:00:00.000Z',
      completed_at: '2026-09-05T10:00:00.000Z',
    })
    await db.workoutSets.bulkPut([
      completedLast,
      storedSet({
        created_at: '2026-09-03T10:00:00.000Z',
        completed_at: '2026-09-04T10:00:00.000Z',
      }),
    ])

    expect(await lastSetFor(BENCH_ID)).toEqual(completedLast)
  })

  it('reads created_at for a set with no completed_at', async () => {
    const written = storedSet({ created_at: '2026-09-06T10:00:00.000Z', completed_at: null })
    await db.workoutSets.bulkPut([
      storedSet({
        created_at: '2026-09-01T10:00:00.000Z',
        completed_at: '2026-09-05T10:00:00.000Z',
      }),
      written,
    ])

    expect(await lastSetFor(BENCH_ID)).toEqual(written)
  })

  it('compares the instant, not the text, of two offsets', async () => {
    const later = storedSet({ completed_at: '2026-09-05T09:30:00.000Z' })
    await db.workoutSets.bulkPut([
      storedSet({ completed_at: '2026-09-05T11:00:00.000+02:00' }),
      later,
    ])

    expect(await lastSetFor(BENCH_ID)).toEqual(later)
  })
})

describe('setsForExercises', () => {
  it('returns an empty list for no exercise ids', async () => {
    await db.workoutSets.put(storedSet({}))

    expect(await setsForExercises([])).toEqual([])
  })

  it('returns every live set of the asked exercises, across sessions', async () => {
    const bench = storedSet({})
    const squat = storedSet({ exercise_id: SQUAT_ID })
    await db.workoutSets.bulkPut([
      bench,
      squat,
      storedSet({ exercise_id: DEVELOPPE_ID }),
      storedSet({ deleted_at: '2026-09-02T10:00:00.000Z' }),
    ])

    const found = await setsForExercises([BENCH_ID, SQUAT_ID])

    expect(found.map((row) => row.id).sort()).toEqual([bench.id, squat.id].sort())
  })
})

describe('lastSetsFor', () => {
  it('returns an empty map for no exercise ids', async () => {
    await db.workoutSets.put(storedSet({}))

    expect(await lastSetsFor([])).toEqual(new Map())
  })

  it('leaves out an exercise with no set', async () => {
    expect(await lastSetsFor([BENCH_ID])).toEqual(new Map())
  })

  it('returns the newest set per exercise in one read', async () => {
    const bench = storedSet({ created_at: '2026-09-03T10:00:00.000Z', reps: 3 })
    const squat = storedSet({ exercise_id: SQUAT_ID, created_at: '2026-09-02T10:00:00.000Z' })
    await db.workoutSets.bulkPut([
      storedSet({ created_at: '2026-09-01T10:00:00.000Z' }),
      bench,
      storedSet({ exercise_id: SQUAT_ID, created_at: '2026-09-01T10:00:00.000Z' }),
      squat,
    ])

    expect(await lastSetsFor([BENCH_ID, SQUAT_ID])).toEqual(
      new Map([
        [BENCH_ID, bench],
        [SQUAT_ID, squat],
      ]),
    )
  })

  it('ignores a set of an exercise it was not asked about', async () => {
    await db.workoutSets.put(storedSet({ exercise_id: SQUAT_ID }))

    expect(await lastSetsFor([BENCH_ID])).toEqual(new Map())
  })

  it('takes the higher set_index when two sets share a timestamp', async () => {
    const later = storedSet({ set_index: 1 })
    await db.workoutSets.bulkPut([later, storedSet({ set_index: 0 })])

    expect((await lastSetsFor([BENCH_ID])).get(BENCH_ID)).toEqual(later)
  })

  it('skips a soft-deleted set', async () => {
    const session = await startSession('2026-09-01')
    const kept = await addSet(aSet(session.id, { reps: 5 }))
    const removed = await addSet(aSet(session.id, { reps: 6 }))
    await deleteSet(removed.id)

    expect((await lastSetsFor([BENCH_ID])).get(BENCH_ID)).toEqual(kept)
  })

  it('agrees with lastSetFor for every exercise', async () => {
    await db.workoutSets.bulkPut([
      storedSet({ created_at: '2026-09-01T10:00:00.000Z' }),
      storedSet({ created_at: '2026-09-05T10:00:00.000Z', set_index: 2 }),
      storedSet({ exercise_id: SQUAT_ID, created_at: '2026-09-04T10:00:00.000Z' }),
      storedSet({
        exercise_id: SQUAT_ID,
        deleted_at: '2026-09-06T10:00:00.000Z',
        created_at: '2026-09-06T10:00:00.000Z',
      }),
    ])

    const found = await lastSetsFor([BENCH_ID, SQUAT_ID])

    expect(found.get(BENCH_ID)).toEqual(await lastSetFor(BENCH_ID))
    expect(found.get(SQUAT_ID)).toEqual(await lastSetFor(SQUAT_ID))
  })

  it('picks the set completed last, the same as lastSetFor', async () => {
    const completedLast = storedSet({
      created_at: '2026-09-01T10:00:00.000Z',
      completed_at: '2026-09-05T10:00:00.000Z',
    })
    await db.workoutSets.bulkPut([
      storedSet({
        created_at: '2026-09-03T10:00:00.000Z',
        completed_at: '2026-09-04T10:00:00.000Z',
      }),
      completedLast,
      storedSet({ created_at: '2026-09-02T10:00:00.000Z' }),
    ])

    expect((await lastSetsFor([BENCH_ID])).get(BENCH_ID)).toEqual(completedLast)
    expect(await lastSetFor(BENCH_ID)).toEqual(completedLast)
  })
})

describe('a workout write on a signed-out device', () => {
  it('throws SignedOutOnThisDevice and stores nothing', async () => {
    const session = await startSession('2026-09-01')
    const set = await addSet(aSet(session.id))
    const gone = await addSet(aSet(session.id))
    await deleteSet(gone.id)
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-09-02T00:00:00.000Z' })
    const sessionsBefore = await db.workoutSessions.toArray()
    const setsBefore = await db.workoutSets.toArray()
    const queued = await db.outbox.count()

    const refusals = [
      await refusal(startSession('2026-09-02')),
      await refusal(finishSession(session.id)),
      await refusal(discardSession(session.id)),
      await refusal(addSet(aSet(session.id))),
      await refusal(updateSet(set.id, { reps: 9 })),
      await refusal(deleteSet(set.id)),
      await refusal(restoreSet(gone.id)),
    ]

    expect(refusals.every((cause) => cause instanceof SignedOutOnThisDevice)).toBe(true)
    expect(await db.workoutSessions.toArray()).toEqual(sessionsBefore)
    expect(await db.workoutSets.toArray()).toEqual(setsBefore)
    expect(await db.outbox.count()).toBe(queued)
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
        request: async (
          _name: string,
          optionsOrCallback: object,
          maybeCallback?: () => Promise<unknown>,
        ) => {
          const callback =
            typeof optionsOrCallback === 'function'
              ? (optionsOrCallback as () => Promise<unknown>)
              : maybeCallback
          holding = true
          try {
            return await callback?.()
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

  it('keeps the sign-out marker while the session ends, and lifts it once the sign-out ends', async () => {
    let markerWhileEnding: string | null = null

    await clearAll(await counted(), () => {
      markerWhileEnding = globalThis.localStorage.getItem(SIGN_OUT_MARKER)
      return endSession()
    })

    expect(markerWhileEnding).not.toBeNull()
    expect(globalThis.localStorage.getItem(SIGN_OUT_MARKER)).toBeNull()
  })

  it('refuses every save once the device is cleared for a sign-out, and stores nothing', async () => {
    await updateProfile({ step_goal: 9000 })
    await upsertDay(entry('2026-09-01', { steps: 4000 }))
    await clearAll(await counted(), endSession)

    const refusals = await Promise.all(
      [
        upsertDay(entry('2026-09-02', { steps: 5000 })),
        softDeleteDay('2026-09-01'),
        updateProfile({ step_goal: 8000 }),
      ].map((write) =>
        write.then(
          () => null,
          (cause: unknown) => cause,
        ),
      ),
    )

    expect(refusals.every((cause) => cause instanceof SignedOutOnThisDevice)).toBe(true)
    expect(refusals[0]).toMatchObject({
      message: 'This device is signed out. Sign in again to save.',
    })
    expect(await db.dailyEntries.count()).toBe(0)
    expect(await db.profiles.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps refusing saves when another tab resumes after this tab signed out', async () => {
    await clearAll(await counted(), endSession)
    vi.resetModules()
    const otherTab = await import('../sync/worker')

    otherTab.resumeSync()
    await new Promise((resolve) => setTimeout(resolve, 20))
    const saved = await upsertDay(entry('2026-09-02', { steps: 5000 })).then(
      () => 'saved',
      (cause: unknown) => cause,
    )

    expect(saved).toBeInstanceOf(SignedOutOnThisDevice)
    expect(await db.syncMeta.get(SIGNED_OUT_KEY)).toBeDefined()
  })

  it('refuses a stale confirm count after a failed sign-out, so a later save is never cleared unseen', async () => {
    const confirmed = await counted()
    await upsertDay(entry('2026-09-01', { steps: 4000 }))
    const stale = await counted()
    await clearAll(stale, endSession)
    resumeFromRepository()
    await vi.waitFor(async () => {
      expect(await db.syncMeta.get(SIGNED_OUT_KEY)).toBeUndefined()
    })
    await upsertDay(entry('2026-09-02', { steps: 5000 }))

    const refused = await clearAll(stale, endSession).then(
      () => null,
      (cause: unknown) => cause,
    )

    expect(confirmed.sequence).toBeLessThan(stale.sequence)
    expect(refused).toBeInstanceOf(UnsyncedWritesChanged)
    expect(await getDay('2026-09-02')).toMatchObject({ steps: 5000 })
  })

  it('takes saves again once a failed sign-out resumes the worker', async () => {
    await clearAll(await counted(), endSession)

    resumeFromRepository()
    await vi.waitFor(async () => {
      expect(await db.syncMeta.get(SIGNED_OUT_KEY)).toBeUndefined()
    })
    const saved = await upsertDay(entry('2026-09-02', { steps: 5000 }))

    expect(saved.steps).toBe(5000)
    expect(await db.outbox.count()).toBe(1)
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
    expect((await db.syncMeta.toArray()).map((record) => record.key).sort()).toEqual(
      [OUTBOX_SEQUENCE_KEY, SIGNED_OUT_KEY].sort(),
    )
  })

  it('empties the exercises, the workout sessions and the workout sets too', async () => {
    await seedGlobals()
    await createExercise({ name: 'Cable Fly', muscle_group: 'chest', is_archived: false })
    await db.workoutSessions.put({
      id: REST_EXERCISE_ID,
      entry_date: '2026-09-01',
      started_at: '2026-09-01T10:00:00.000Z',
      ended_at: null,
      status: 'active',
      created_at: '2026-09-01T10:00:00.000Z',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
    })
    await db.workoutSets.put({
      id: SQUAT_ID,
      session_id: REST_EXERCISE_ID,
      exercise_id: BENCH_ID,
      set_index: 0,
      reps: 8,
      weight_kg: 60,
      rpe: null,
      completed_at: null,
      created_at: '2026-09-01T10:00:00.000Z',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
    })

    await clearAll(await counted(), endSession)

    expect(await db.exercises.count()).toBe(0)
    expect(await db.workoutSessions.count()).toBe(0)
    expect(await db.workoutSets.count()).toBe(0)
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
