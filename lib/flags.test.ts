import { afterEach, describe, expect, it, vi } from 'vitest'

import { csvImportEnabled } from './flags'

describe('csvImportEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is off when the flag is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CSV_IMPORT', '')
    expect(csvImportEnabled()).toBe(false)
  })

  it('is on when the flag is 1', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CSV_IMPORT', '1')
    expect(csvImportEnabled()).toBe(true)
  })
})
