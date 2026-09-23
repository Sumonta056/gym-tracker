import { describe, expect, it } from 'vitest'

import { DEFAULT_WINDOW_DAYS, movingAverage } from './movingAverage'

describe('movingAverage', () => {
  it('returns an empty list for an empty input', () => {
    expect(movingAverage([])).toEqual([])
  })

  it('averages over seven days by default', () => {
    expect(DEFAULT_WINDOW_DAYS).toBe(7)
  })

  it('returns the first value as the average at index 0', () => {
    const points = [
      { date: '2026-09-21', value: 72.4 },
      { date: '2026-09-22', value: 73.6 },
    ]

    expect(movingAverage(points)[0]?.average).toBe(72.4)
  })

  it('returns a value, not null, for a window shorter than seven days', () => {
    const points = [
      { date: '2026-09-21', value: 70 },
      { date: '2026-09-22', value: 72 },
      { date: '2026-09-23', value: 74 },
    ]

    expect(movingAverage(points).map((point) => point.average)).toEqual([70, 71, 72])
  })

  it('keeps every input date in the result', () => {
    const points = [
      { date: '2026-09-21', value: 70 },
      { date: '2026-09-23', value: 74 },
    ]

    expect(movingAverage(points).map((point) => point.date)).toEqual(['2026-09-21', '2026-09-23'])
  })

  it('does not shift the window when the dates are sparse', () => {
    const points = [
      { date: '2026-09-01', value: 70 },
      { date: '2026-09-10', value: 80 },
    ]

    expect(movingAverage(points)[1]?.average).toBe(80)
  })

  it('includes a point exactly seven calendar days back', () => {
    const points = [
      { date: '2026-09-01', value: 70 },
      { date: '2026-09-07', value: 80 },
    ]

    expect(movingAverage(points)[1]?.average).toBe(75)
  })

  it('drops a point one day outside the window', () => {
    const points = [
      { date: '2026-09-01', value: 70 },
      { date: '2026-09-08', value: 80 },
    ]

    expect(movingAverage(points)[1]?.average).toBe(80)
  })

  it('holds the window steady across a month boundary', () => {
    const points = [
      { date: '2026-09-30', value: 70 },
      { date: '2026-10-01', value: 80 },
    ]

    expect(movingAverage(points)[1]?.average).toBe(75)
  })

  it('sorts the points by date before it averages', () => {
    const points = [
      { date: '2026-09-23', value: 74 },
      { date: '2026-09-21', value: 70 },
    ]

    expect(movingAverage(points).map((point) => point.date)).toEqual(['2026-09-21', '2026-09-23'])
  })

  it('skips a null value instead of counting it as zero', () => {
    const points = [
      { date: '2026-09-21', value: 70 },
      { date: '2026-09-22', value: null },
      { date: '2026-09-23', value: 74 },
    ]

    expect(movingAverage(points)[2]?.average).toBe(72)
  })

  it('returns a null average when the window holds no value at all', () => {
    expect(movingAverage([{ date: '2026-09-21', value: null }])[0]?.average).toBeNull()
  })

  it('carries the raw value through beside the average', () => {
    expect(movingAverage([{ date: '2026-09-21', value: 70 }])[0]?.value).toBe(70)
  })

  it('drops a malformed date instead of throwing', () => {
    const points = [
      { date: 'yesterday', value: 70 },
      { date: '2026-09-23', value: 74 },
    ]

    expect(movingAverage(points)).toEqual([{ date: '2026-09-23', value: 74, average: 74 }])
  })

  it('honours a window of another length', () => {
    const points = [
      { date: '2026-09-21', value: 70 },
      { date: '2026-09-22', value: 72 },
      { date: '2026-09-23', value: 80 },
    ]

    expect(movingAverage(points, 2).map((point) => point.average)).toEqual([70, 71, 76])
  })

  it('treats a window below one day as a single day', () => {
    const points = [
      { date: '2026-09-21', value: 70 },
      { date: '2026-09-22', value: 72 },
    ]

    expect(movingAverage(points, 0).map((point) => point.average)).toEqual([70, 72])
  })
})
