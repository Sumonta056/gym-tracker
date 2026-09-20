import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

import { cleanup } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach } from 'vitest'

type DatabaseReset = () => Promise<void> | void

const databaseResets = new Set<DatabaseReset>()

export function registerDatabaseReset(reset: DatabaseReset): void {
  databaseResets.add(reset)
}

afterEach(async () => {
  cleanup()
  for (const reset of databaseResets) {
    await reset()
  }
  globalThis.indexedDB = new IDBFactory()
})
