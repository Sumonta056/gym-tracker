import { describe, expect, it } from 'vitest'

import { goalPercent, sinceLastWeighIn, versusAverage } from './dayCompare'

describe('goalPercent', () => {
  it('returns the rounded percent of the goal', () => {
    expect(goalPercent(800, 1000)).toBe(80)
  })

  it('rounds to the nearest whole percent', () => {
    expect(goalPercent(1005, 2000)).toBe(50)
    expect(goalPercent(1015, 2000)).toBe(51)
  })

  it('returns the real percent past the goal', () => {
    expect(goalPercent(12000, 6000)).toBe(200)
  })

  it('returns 0 for a value of 0', () => {
    expect(goalPercent(0, 6000)).toBe(0)
  })

  it('returns null when the value is null', () => {
    expect(goalPercent(null, 6000)).toBeNull()
  })

  it('returns null when the goal is null', () => {
    expect(goalPercent(800, null)).toBeNull()
  })

  it('returns null when the goal is 0', () => {
    expect(goalPercent(800, 0)).toBeNull()
  })

  it('returns null when the goal is negative', () => {
    expect(goalPercent(800, -5)).toBeNull()
  })
})

describe('versusAverage', () => {
  it('returns the average of the earlier days and a rising delta', () => {
    expect(versusAverage(12000, [8000, 9000, null, 10000])).toEqual({
      average: 9000,
      delta: 3000,
      direction: 'up',
    })
  })

  it('returns a falling delta below the average', () => {
    expect(versusAverage(800, [900, 1000])).toEqual({
      average: 950,
      delta: -150,
      direction: 'down',
    })
  })

  it('returns same when today equals the average', () => {
    expect(versusAverage(30, [20, 40])).toEqual({ average: 30, delta: 0, direction: 'same' })
  })

  it('rounds the average and the delta to two decimals', () => {
    expect(versusAverage(10, [1, 2, 2])).toEqual({
      average: 1.67,
      delta: 8.33,
      direction: 'up',
    })
  })

  it('returns same when the delta rounds to 0', () => {
    expect(versusAverage(1.001, [1, 1])?.direction).toBe('same')
  })

  it('returns null when today is null', () => {
    expect(versusAverage(null, [1, 2, 3])).toBeNull()
  })

  it('returns null with fewer than 2 earlier values', () => {
    expect(versusAverage(5, [null, 4, null])).toBeNull()
  })

  it('returns null with no earlier days', () => {
    expect(versusAverage(5, [])).toBeNull()
  })
})

describe('sinceLastWeighIn', () => {
  it('returns the change from the weigh-in before the latest', () => {
    expect(
      sinceLastWeighIn([
        { date: '2026-10-11', weightKg: 80.6 },
        { date: '2026-10-13', weightKg: 80.4 },
        { date: '2026-10-14', weightKg: null },
        { date: '2026-10-16', weightKg: 80 },
      ]),
    ).toEqual({ deltaKg: -0.4, previousDate: '2026-10-13' })
  })

  it('skips a trailing day with no weight', () => {
    expect(
      sinceLastWeighIn([
        { date: '2026-10-14', weightKg: 80 },
        { date: '2026-10-15', weightKg: 80.25 },
        { date: '2026-10-16', weightKg: null },
      ]),
    ).toEqual({ deltaKg: 0.25, previousDate: '2026-10-14' })
  })

  it('returns null with one weigh-in', () => {
    expect(
      sinceLastWeighIn([
        { date: '2026-10-15', weightKg: null },
        { date: '2026-10-16', weightKg: 80 },
      ]),
    ).toBeNull()
  })

  it('returns null with no points', () => {
    expect(sinceLastWeighIn([])).toBeNull()
  })
})
