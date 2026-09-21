import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { createDatabase, DATABASE_NAME, DATABASE_VERSION, db } from './dexie'

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

  it('declares the four tables of version 1', async () => {
    const instance = createDatabase('gym-tracker-tables')
    opened.push(instance)
    await instance.open()

    expect(instance.tables.map((table) => table.name).sort()).toEqual([
      'dailyEntries',
      'outbox',
      'profiles',
      'syncMeta',
    ])
    expect(instance.verno).toBe(DATABASE_VERSION)
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

  it('keys the daily entries, the profiles and the outbox on id', async () => {
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
      syncMeta: 'key',
    })
  })
})

describe('db', () => {
  it('is a single shared instance of the gym tracker database', () => {
    expect(db.name).toBe(DATABASE_NAME)
  })
})
