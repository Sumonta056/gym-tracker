import { describe, expect, it } from 'vitest'

import { epley } from './epley'

describe('epley', () => {
  it('returns the load itself for one rep', () => {
    expect(epley(100, 1)).toBe(100)
  })

  it('returns 53.33 for ten reps at 40 kg', () => {
    expect(epley(40, 10)).toBe(53.33)
  })

  it('returns 150 for thirty reps at 75 kg', () => {
    expect(epley(75, 30)).toBe(150)
  })

  it('returns 0 for a body weight load of 0 kg', () => {
    expect(epley(0, 12)).toBe(0)
  })

  it('returns null for zero reps', () => {
    expect(epley(40, 0)).toBeNull()
  })

  it('returns null for negative reps', () => {
    expect(epley(40, -3)).toBeNull()
  })

  it('returns null for reps that are not a number', () => {
    expect(epley(40, Number.NaN)).toBeNull()
  })

  it('returns null for a null load', () => {
    expect(epley(null, 10)).toBeNull()
  })

  it('returns null for a negative load', () => {
    expect(epley(-5, 10)).toBeNull()
  })

  it('returns null for a load that is not finite', () => {
    expect(epley(Number.POSITIVE_INFINITY, 10)).toBeNull()
  })
})
