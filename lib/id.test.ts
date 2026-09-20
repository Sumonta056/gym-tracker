import { describe, expect, it } from 'vitest'

import { newId } from './id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('returns a version 4 uuid', () => {
    expect(newId()).toMatch(UUID_V4)
  })

  it('returns a different value on every call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()))
    expect(ids.size).toBe(100)
  })
})
