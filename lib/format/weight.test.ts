import { describe, expect, it } from 'vitest'

import {
  formatWeight,
  fromDisplayWeight,
  KG_PER_LB,
  toDisplayWeight,
  weightSymbol,
  weightWord,
} from './weight'

describe('weightSymbol', () => {
  it('writes kg for metric and lb for imperial', () => {
    expect(weightSymbol('metric')).toBe('kg')
    expect(weightSymbol('imperial')).toBe('lb')
  })
})

describe('weightWord', () => {
  it('spells the unit out for a screen reader', () => {
    expect(weightWord('metric')).toBe('kilograms')
    expect(weightWord('imperial')).toBe('pounds')
  })
})

describe('toDisplayWeight', () => {
  it('returns the stored kilograms unchanged for metric', () => {
    expect(toDisplayWeight(71, 'metric')).toBe(71)
  })

  it('converts kilograms to pounds for imperial', () => {
    expect(toDisplayWeight(KG_PER_LB, 'imperial')).toBe(1)
  })
})

describe('fromDisplayWeight', () => {
  it('keeps a metric value and rounds it to two decimals', () => {
    expect(fromDisplayWeight(71.456, 'metric')).toBe(71.46)
  })

  it('turns pounds back into kilograms with two decimals', () => {
    expect(fromDisplayWeight(156.5, 'imperial')).toBe(70.99)
  })
})

describe('formatWeight', () => {
  it('formats kilograms with the digits asked for', () => {
    expect(formatWeight(73.65, 'metric', 2)).toBe('73.65')
  })

  it('formats pounds with the digits asked for', () => {
    expect(formatWeight(71, 'imperial', 1)).toBe('156.5')
  })
})
