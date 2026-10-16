import { describe, expect, it } from 'vitest'

import { formatDuration } from '../../lib/duration'

import { formatCount } from './summary'
import { goalHint, weightGapText } from './todayText'

describe('goalHint', () => {
  it('writes the share of a calorie goal', () => {
    expect(goalHint(963, 800, (value) => `${formatCount(value)} kcal`)).toBe('120% of 800 kcal')
  })

  it('writes the share of a walk goal', () => {
    expect(goalHint(3324, 3600, (value) => formatDuration(value, 'short'))).toBe('92% of 1h')
  })
})

describe('weightGapText', () => {
  it('writes the gap in kilograms', () => {
    expect(weightGapText(2.4, 'metric')).toBe('2.4 kg to go')
  })

  it('writes the gap in pounds for imperial', () => {
    expect(weightGapText(2.4, 'imperial')).toBe('5.3 lb to go')
  })

  it('says on target under 0.05 kg', () => {
    expect(weightGapText(0.04, 'metric')).toBe('On target')
  })

  it('says on target with no gap at all', () => {
    expect(weightGapText(0, 'metric')).toBe('On target')
  })

  it('writes a gap of exactly 0.05 kg as a gap to go', () => {
    expect(weightGapText(0.05, 'metric')).toMatch(/ kg to go$/)
  })
})
