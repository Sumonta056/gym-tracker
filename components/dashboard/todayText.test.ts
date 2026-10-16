import { describe, expect, it } from 'vitest'

import { formatDuration } from '../../lib/duration'
import { BENCH, LEG } from '../../tests/fixtures/lifts'

import { formatCount } from './summary'
import { goalHint, weightGapText, workoutLine } from './todayText'

import type { SessionStats } from '../../lib/metrics/sessionStats'

const STATS: SessionStats = {
  durationSeconds: 3600,
  setCount: 2,
  exerciseCount: 1,
  volumeKg: 1120,
  newRecords: [],
}

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

describe('workoutLine', () => {
  it('writes the session line with no record', () => {
    expect(workoutLine(STATS, 'metric')).toBe('1h · 2 sets · 1,120 kg')
  })

  it('adds 1 new record', () => {
    const stats = { ...STATS, newRecords: [{ exerciseId: BENCH, weightKg: 65, reps: 5 }] }
    expect(workoutLine(stats, 'metric')).toBe('1h · 2 sets · 1,120 kg · 1 new record')
  })

  it('adds 2 new records', () => {
    const stats = {
      ...STATS,
      newRecords: [
        { exerciseId: BENCH, weightKg: 65, reps: 5 },
        { exerciseId: LEG, weightKg: 140, reps: 8 },
      ],
    }
    expect(workoutLine(stats, 'metric')).toBe('1h · 2 sets · 1,120 kg · 2 new records')
  })
})
