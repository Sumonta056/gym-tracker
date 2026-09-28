import { describe, expect, it } from 'vitest'

import { roundTo2 } from './round'

describe('roundTo2', () => {
  it('rounds a long fraction to two decimals', () => {
    expect(roundTo2(53.333333)).toBe(53.33)
  })

  it('removes floating point drift from a sum', () => {
    expect(roundTo2(0.1 + 0.2)).toBe(0.3)
  })

  it('rounds half up at the third decimal', () => {
    expect(roundTo2(1.005 + 0.0001)).toBe(1.01)
  })

  it('keeps a whole number unchanged', () => {
    expect(roundTo2(400)).toBe(400)
  })

  it('returns 0 for a value that is not finite', () => {
    expect(roundTo2(Number.NaN)).toBe(0)
  })
})
