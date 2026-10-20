import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createDatabase,
  createVersionWatch,
  DATABASE_NAME,
  DATABASE_VERSION,
  db,
  getVersionState,
  STORES,
  STORES_V1,
  STORES_V3,
  STORES_V4,
  STORES_V5,
  subscribeVersionState,
  versionWatch,
} from './dexie'

describe('createDatabase', () => {
  const opened: { close: () => void; delete: () => Promise<void> }[] = []

  afterEach(async () => {
    for (const instance of opened) {
      instance.close()
      await instance.delete()
    }

    opened.length = 0
  })

  it('names the database gym-tracker by default', () => {
    const instance = createDatabase()
    opened.push(instance)

    expect(instance.name).toBe(DATABASE_NAME)
  })

  it('accepts a different name for an isolated database', () => {
    const instance = createDatabase('gym-tracker-alt')
    opened.push(instance)

    expect(instance.name).toBe('gym-tracker-alt')
  })

  it('declares the ten tables of version 6', async () => {
    const instance = createDatabase('gym-tracker-tables')
    opened.push(instance)
    await instance.open()

    expect(instance.tables.map((table) => table.name).sort()).toEqual([
      'dailyEntries',
      'deadLetters',
      'errorLog',
      'exercises',
      'outbox',
      'planCursors',
      'profiles',
      'syncMeta',
      'workoutSessions',
      'workoutSets',
    ])
    expect(instance.verno).toBe(6)
    expect(DATABASE_VERSION).toBe(6)
  })

  it('upgrades a version 1 database and keeps every row it held', async () => {
    const name = 'gym-tracker-upgrade'
    const old = new Dexie(name)
    old.version(1).stores(STORES_V1)
    await old.open()
    await old.table('syncMeta').put({ key: 'outbox_sequence', value: '4' })
    old.close()

    const instance = createDatabase(name)
    opened.push(instance)
    await instance.open()

    expect(instance.verno).toBe(DATABASE_VERSION)
    expect(await instance.syncMeta.get('outbox_sequence')).toEqual({
      key: 'outbox_sequence',
      value: '4',
    })
    expect(await instance.deadLetters.count()).toBe(0)
  })

  it('upgrades a version 2 database and keeps every row it held', async () => {
    const name = 'gym-tracker-upgrade-v2'
    const old = new Dexie(name)
    old.version(1).stores(STORES_V1)
    old.version(2).stores({ ...STORES_V1, deadLetters: '&id, sequence' })
    await old.open()

    const entry = {
      id: '11111111-1111-4111-8111-111111111111',
      entry_date: '2026-09-20',
      walk_seconds: 1800,
      gym_seconds: 3600,
      weight_kg: 80.5,
      created_at: '2026-09-20T08:00:00.000Z',
      updated_at: '2026-09-20T08:00:00.000Z',
      deleted_at: null,
    }
    const profile = {
      id: '00000000-0000-4000-8000-000000000000',
      unit_system: 'metric',
      step_goal: 12000,
      updated_at: '2026-09-20T08:00:00.000Z',
    }
    const queued = {
      id: '22222222-2222-4222-8222-222222222222',
      sequence: 5,
      table_name: 'daily_entries',
      operation: 'upsert',
      row_id: entry.id,
      payload: entry,
      created_at: '2026-09-20T08:00:00.000Z',
      attempts: 0,
      last_error: null,
      next_attempt_at: null,
    }
    const dead = {
      ...queued,
      id: '33333333-3333-4333-8333-333333333333',
      sequence: 4,
      attempts: 3,
      last_error: 'refused',
      error_code: '23514',
      failed_at: '2026-09-20T08:05:00.000Z',
    }

    await old.table('dailyEntries').put(entry)
    await old.table('profiles').put(profile)
    await old.table('outbox').put(queued)
    await old.table('deadLetters').put(dead)
    await old.table('syncMeta').put({ key: 'outbox_sequence', value: '5' })
    old.close()

    const instance = createDatabase(name)
    opened.push(instance)
    await instance.open()

    expect(instance.verno).toBe(DATABASE_VERSION)
    expect(await instance.dailyEntries.toArray()).toEqual([entry])
    expect(await instance.profiles.toArray()).toEqual([profile])
    expect(await instance.outbox.toArray()).toEqual([queued])
    expect(await instance.deadLetters.toArray()).toEqual([dead])
    expect(await instance.syncMeta.toArray()).toEqual([{ key: 'outbox_sequence', value: '5' }])
    expect(await instance.exercises.count()).toBe(0)
    expect(await instance.workoutSessions.count()).toBe(0)
    expect(await instance.workoutSets.count()).toBe(0)
  })

  it('upgrades a version 3 database, keeps every row and starts an empty error log', async () => {
    const name = 'gym-tracker-upgrade-v3'
    const old = new Dexie(name)
    old.version(1).stores(STORES_V1)
    old.version(3).stores(STORES_V3)
    await old.open()
    await old.table('syncMeta').put({ key: 'outbox_sequence', value: '9' })
    old.close()

    const instance = createDatabase(name)
    opened.push(instance)
    await instance.open()

    expect(instance.verno).toBe(DATABASE_VERSION)
    expect(await instance.syncMeta.get('outbox_sequence')).toEqual({
      key: 'outbox_sequence',
      value: '9',
    })
    expect(await instance.errorLog.count()).toBe(0)
  })

  it('upgrades a version 4 database and keeps every row it held', async () => {
    const name = 'gym-tracker-upgrade-v4'
    const old = new Dexie(name)
    old.version(4).stores(STORES_V4)
    await old.open()
    const entry = {
      id: '11111111-1111-4111-8111-111111111111',
      entry_date: '2026-10-01',
      walk_seconds: 1800,
      gym_seconds: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
      deleted_at: null,
    }
    const profile = {
      id: '00000000-0000-4000-8000-000000000000',
      unit_system: 'metric',
      step_goal: 12000,
      updated_at: '2026-10-01T08:00:00.000Z',
    }
    await old.table('dailyEntries').put(entry)
    await old.table('profiles').put(profile)
    old.close()

    const instance = createDatabase(name)
    opened.push(instance)
    await instance.open()

    expect(instance.verno).toBe(DATABASE_VERSION)
    expect(await instance.dailyEntries.toArray()).toEqual([entry])
    expect(await instance.profiles.toArray()).toEqual([profile])
  })

  it('upgrades a version 5 database, keeps every row and starts no plan cursor', async () => {
    const name = 'gym-tracker-upgrade-v5'
    const old = new Dexie(name)
    old.version(5).stores(STORES_V5)
    await old.open()
    const stamp = '2026-10-10T08:00:00.000Z'
    const entry = {
      id: '11111111-1111-4111-8111-111111111111',
      entry_date: '2026-10-10',
      walk_seconds: 1800,
      gym_seconds: 3600,
      swim_seconds: 600,
      created_at: stamp,
      updated_at: stamp,
      deleted_at: null,
    }
    const profile = {
      id: '00000000-0000-4000-8000-000000000000',
      unit_system: 'metric',
      step_goal: 12000,
      calorie_goal: 2400,
      updated_at: stamp,
    }
    const exercise = {
      id: '8e7bfa97-3837-4259-bd85-c93f7d5db288',
      user_id: null,
      name: 'Lat Pulldown',
      muscle_group: 'back',
      is_archived: false,
      created_at: stamp,
      updated_at: stamp,
      deleted_at: null,
    }
    const session = {
      id: '44444444-4444-4444-8444-444444444444',
      entry_date: '2026-10-10',
      started_at: stamp,
      ended_at: '2026-10-10T09:00:00.000Z',
      status: 'finished',
      created_at: stamp,
      updated_at: stamp,
      deleted_at: null,
    }
    const set = {
      id: '55555555-5555-4555-8555-555555555555',
      session_id: session.id,
      exercise_id: exercise.id,
      set_index: 0,
      reps: 10,
      weight_kg: 40,
      rpe: null,
      completed_at: stamp,
      created_at: stamp,
      updated_at: stamp,
      deleted_at: null,
    }
    const queued = {
      id: '22222222-2222-4222-8222-222222222222',
      sequence: 7,
      table_name: 'workout_sessions',
      operation: 'upsert',
      row_id: session.id,
      payload: session,
      created_at: stamp,
      attempts: 0,
      last_error: null,
      next_attempt_at: null,
    }
    const dead = {
      ...queued,
      id: '33333333-3333-4333-8333-333333333333',
      sequence: 6,
      attempts: 3,
      last_error: 'refused',
      error_code: '23514',
      failed_at: stamp,
    }
    const error = { id: '66666666-6666-4666-8666-666666666666', at: stamp, message: 'boom' }

    await old.table('dailyEntries').put(entry)
    await old.table('profiles').put(profile)
    await old.table('exercises').put(exercise)
    await old.table('workoutSessions').put(session)
    await old.table('workoutSets').put(set)
    await old.table('outbox').put(queued)
    await old.table('deadLetters').put(dead)
    await old.table('errorLog').put(error)
    await old.table('syncMeta').put({ key: 'outbox_sequence', value: '7' })
    old.close()

    const instance = createDatabase(name)
    opened.push(instance)
    await instance.open()

    expect(instance.verno).toBe(6)
    expect(await instance.dailyEntries.toArray()).toEqual([entry])
    expect(await instance.profiles.toArray()).toEqual([profile])
    expect(await instance.exercises.toArray()).toEqual([exercise])
    expect(await instance.workoutSessions.toArray()).toEqual([{ ...session, plan_ids: null }])
    expect(await instance.workoutSets.toArray()).toEqual([set])
    expect(await instance.outbox.toArray()).toEqual([queued])
    expect(await instance.deadLetters.toArray()).toEqual([dead])
    expect(await instance.errorLog.toArray()).toEqual([error])
    expect(await instance.syncMeta.toArray()).toEqual([{ key: 'outbox_sequence', value: '7' }])
    expect(await instance.planCursors.count()).toBe(0)
  })

  it('keeps the plan ids of a version 5 session that already holds them', async () => {
    const name = 'gym-tracker-upgrade-v5-plans'
    const old = new Dexie(name)
    old.version(5).stores(STORES_V5)
    await old.open()
    const session = {
      id: '44444444-4444-4444-8444-444444444444',
      entry_date: '2026-10-10',
      started_at: '2026-10-10T08:00:00.000Z',
      ended_at: null,
      status: 'active',
      plan_ids: ['legs'],
      created_at: '2026-10-10T08:00:00.000Z',
      updated_at: '2026-10-10T08:00:00.000Z',
      deleted_at: null,
    }
    await old.table('workoutSessions').put(session)
    old.close()

    const instance = createDatabase(name)
    opened.push(instance)
    await instance.open()

    expect(await instance.workoutSessions.toArray()).toEqual([session])
  })

  it('keys the plan cursors on sessionId with no other index', async () => {
    const instance = createDatabase('gym-tracker-cursor-indexes')
    opened.push(instance)
    await instance.open()

    const cursors = instance.tables.find((table) => table.name === 'planCursors')

    expect(cursors?.schema.primKey.keyPath).toBe('sessionId')
    expect(cursors?.schema.indexes).toEqual([])
  })

  it('stores a plan cursor and reads it back by its session id', async () => {
    const instance = createDatabase('gym-tracker-cursor-round-trip')
    opened.push(instance)
    await instance.open()
    const cursor = {
      sessionId: '44444444-4444-4444-8444-444444444444',
      stepIndex: 2,
      skipped: ['flat-dumbbell-fly'],
    }

    await instance.planCursors.put(cursor)

    expect(await instance.planCursors.get(cursor.sessionId)).toEqual(cursor)
  })

  it('indexes the error log on at', async () => {
    const instance = createDatabase('gym-tracker-error-indexes')
    opened.push(instance)
    await instance.open()

    const indexes = instance.tables
      .filter((table) => table.name === 'errorLog')
      .flatMap((table) => table.schema.indexes.map((index) => index.name))

    expect(indexes).toEqual(['at'])
  })

  it('indexes the exercises on muscle_group and on updated_at', async () => {
    const instance = createDatabase('gym-tracker-exercise-indexes')
    opened.push(instance)
    await instance.open()

    const indexes = instance.tables
      .filter((table) => table.name === 'exercises')
      .flatMap((table) => table.schema.indexes.map((index) => index.name))

    expect(indexes).toEqual(['muscle_group', 'updated_at'])
  })

  it('indexes the workout sessions on entry_date, status and updated_at', async () => {
    const instance = createDatabase('gym-tracker-session-indexes')
    opened.push(instance)
    await instance.open()

    const indexes = instance.tables
      .filter((table) => table.name === 'workoutSessions')
      .flatMap((table) => table.schema.indexes.map((index) => index.name))

    expect(indexes).toEqual(['entry_date', 'status', 'updated_at'])
  })

  it('indexes the workout sets on session_id and on updated_at', async () => {
    const instance = createDatabase('gym-tracker-set-indexes')
    opened.push(instance)
    await instance.open()

    const indexes = instance.tables
      .filter((table) => table.name === 'workoutSets')
      .flatMap((table) => table.schema.indexes.map((index) => index.name))

    expect(indexes).toEqual(['session_id', 'updated_at'])
  })

  it('orders the dead letters by their outbox sequence', async () => {
    const instance = createDatabase('gym-tracker-dead-indexes')
    opened.push(instance)
    await instance.open()

    const indexes = instance.tables
      .filter((table) => table.name === 'deadLetters')
      .flatMap((table) => table.schema.indexes.map((index) => index.name))

    expect(indexes).toEqual(['sequence'])
  })

  it('indexes the daily entries on entry_date and on updated_at', async () => {
    const instance = createDatabase('gym-tracker-indexes')
    opened.push(instance)
    await instance.open()

    const indexes = instance.tables
      .filter((table) => table.name === 'dailyEntries')
      .flatMap((table) => table.schema.indexes.map((index) => index.name))

    expect(indexes).toContain('entry_date')
    expect(indexes).toContain('updated_at')
  })

  it('keys every table on id, the sync meta on key and the plan cursors on sessionId', async () => {
    const instance = createDatabase('gym-tracker-keys')
    opened.push(instance)
    await instance.open()

    const primaryKeys = Object.fromEntries(
      instance.tables.map((table) => [table.name, table.schema.primKey.keyPath]),
    )

    expect(primaryKeys).toEqual({
      dailyEntries: 'id',
      profiles: 'id',
      outbox: 'id',
      deadLetters: 'id',
      syncMeta: 'key',
      exercises: 'id',
      workoutSessions: 'id',
      workoutSets: 'id',
      errorLog: 'id',
      planCursors: 'sessionId',
    })
  })
})

describe('db', () => {
  it('is a single shared instance of the gym tracker database', () => {
    expect(db.name).toBe(DATABASE_NAME)
  })
})

describe('the version watch', () => {
  const opened: Dexie[] = []

  afterEach(async () => {
    for (const instance of opened) {
      instance.close()
      await instance.delete()
    }

    opened.length = 0
  })

  it('starts current', () => {
    expect(createVersionWatch().get()).toBe('current')
  })

  it('tells a listener when the state changes', () => {
    const watch = createVersionWatch()
    const listener = vi.fn()
    watch.subscribe(listener)

    watch.set('stale')

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not tell a listener when the state stays the same', () => {
    const watch = createVersionWatch()
    const listener = vi.fn()
    watch.subscribe(listener)

    watch.set('current')

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops telling a listener after it unsubscribes', () => {
    const watch = createVersionWatch()
    const listener = vi.fn()
    const stop = watch.subscribe(listener)

    stop()
    watch.set('stale')

    expect(listener).not.toHaveBeenCalled()
  })

  it('turns stale and closes the database when another tab opens a newer version', async () => {
    const name = 'gym-tracker-versionchange'
    const watch = createVersionWatch()
    const instance = createDatabase(name, watch)
    await instance.open()

    const newer = new Dexie(name)
    newer.version(DATABASE_VERSION + 1).stores(STORES)
    opened.push(newer)
    await newer.open()

    expect(watch.get()).toBe('stale')
    expect(instance.isOpen()).toBe(false)
  })

  it('refuses every read after it turned stale, so no old code writes to a new schema', async () => {
    const name = 'gym-tracker-stale-read'
    const watch = createVersionWatch()
    const instance = createDatabase(name, watch)
    await instance.open()

    const newer = new Dexie(name)
    newer.version(DATABASE_VERSION + 1).stores(STORES)
    opened.push(newer)
    await newer.open()

    await expect(instance.syncMeta.count()).rejects.toThrow()
  })

  it('turns blocked while an old tab holds the database open, then current once it opens', async () => {
    const name = 'gym-tracker-blocked'
    const old = new Dexie(name)
    old.version(1).stores(STORES_V1)
    old.on('versionchange', () => false)
    await old.open()

    const watch = createVersionWatch()
    const instance = createDatabase(name, watch)
    opened.push(instance)
    const opening = instance.open()

    await vi.waitFor(() => {
      expect(watch.get()).toBe('blocked')
    })
    old.close()
    await opening

    expect(watch.get()).toBe('current')
  })

  it('reads and subscribes to the shared watch of the app database', () => {
    const listener = vi.fn()
    const stop = subscribeVersionState(listener)

    versionWatch.set('blocked')
    expect(getVersionState()).toBe('blocked')
    versionWatch.set('current')
    stop()

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
