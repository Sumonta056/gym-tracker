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

  it('declares the nine tables of version 4', async () => {
    const instance = createDatabase('gym-tracker-tables')
    opened.push(instance)
    await instance.open()

    expect(instance.tables.map((table) => table.name).sort()).toEqual([
      'dailyEntries',
      'deadLetters',
      'errorLog',
      'exercises',
      'outbox',
      'profiles',
      'syncMeta',
      'workoutSessions',
      'workoutSets',
    ])
    expect(instance.verno).toBe(4)
    expect(DATABASE_VERSION).toBe(4)
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

    expect(instance.verno).toBe(4)
    expect(await instance.syncMeta.get('outbox_sequence')).toEqual({
      key: 'outbox_sequence',
      value: '9',
    })
    expect(await instance.errorLog.count()).toBe(0)
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

  it('keys every table on id, and the sync meta on key', async () => {
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
