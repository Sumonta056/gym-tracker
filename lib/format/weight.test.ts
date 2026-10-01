import { describe, expect, it } from 'vitest'

import {
  formatLoadShort,
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

describe('formatLoadShort', () => {
  it('rounds a pound load to one decimal', () => {
    expect(formatLoadShort(47.5, 'imperial')).toBe('104.7')
    expect(formatLoadShort(85, 'imperial')).toBe('187.4')
    expect(formatLoadShort(33.75, 'imperial')).toBe('74.4')
  })

  it('drops a trailing .0 from a pound load', () => {
    expect(formatLoadShort(KG_PER_LB * 100, 'imperial')).toBe('100')
  })

  it('keeps a kilo load as logged, to two decimals', () => {
    expect(formatLoadShort(42.5, 'metric')).toBe('42.5')
    expect(formatLoadShort(45, 'metric')).toBe('45')
    expect(formatLoadShort(33.75, 'metric')).toBe('33.75')
  })
})
