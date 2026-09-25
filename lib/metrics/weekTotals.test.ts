import { describe, expect, it } from 'vitest'

import { weekTotals } from './weekTotals'

import type { DailyEntryInput } from '../schema/dailyEntry'

function row(entry: Partial<DailyEntryInput> & { entry_date: string }): DailyEntryInput {
  return {
    walk_seconds: null,
    gym_seconds: null,
    avg_heart_rate: null,
    max_heart_rate: null,
    weight_kg: null,
    calories_burnt: null,
    steps: null,
    note: null,
    ...entry,
  }
}

const EMPTY = {
  sessions: 0,
  gymSeconds: 0,
  walkSeconds: 0,
  calories: 0,
  steps: 0,
}

describe('weekTotals', () => {
  it('returns zeros, not null, for an empty week', () => {
    expect(weekTotals([])).toEqual(EMPTY)
  })

  it('returns zeros for an empty week inside a range', () => {
    expect(weekTotals([], { from: '2026-09-21', to: '2026-09-27' })).toEqual(EMPTY)
  })

  it('adds the five totals across the week', () => {
    const rows = [
      row({ entry_date: '2026-09-21', gym_seconds: 3600, walk_seconds: 1800, steps: 9000 }),
      row({ entry_date: '2026-09-22', gym_seconds: 2700, calories_burnt: 640, steps: 12000 }),
    ]

    expect(weekTotals(rows)).toEqual({
      sessions: 2,
      gymSeconds: 6300,
      walkSeconds: 1800,
      calories: 640,
      steps: 21000,
    })
  })

  it('counts only a day with gym time as a session', () => {
    const rows = [
      row({ entry_date: '2026-09-21', gym_seconds: 3600 }),
      row({ entry_date: '2026-09-22', walk_seconds: 1800 }),
    ]

    expect(weekTotals(rows).sessions).toBe(1)
  })

  it('does not count a day of zero gym seconds as a session', () => {
    expect(weekTotals([row({ entry_date: '2026-09-21', gym_seconds: 0 })]).sessions).toBe(0)
  })

  it('does not produce NaN for a week with a null weight', () => {
    const rows = [
      row({ entry_date: '2026-09-21', weight_kg: null, gym_seconds: 3600, steps: 9000 }),
      row({ entry_date: '2026-09-22', weight_kg: 73.2, gym_seconds: 1800, steps: 4000 }),
    ]
    const totals = weekTotals(rows)

    for (const total of Object.values(totals)) {
      expect(Number.isFinite(total)).toBe(true)
    }

    expect(totals).toEqual({
      sessions: 2,
      gymSeconds: 5400,
      walkSeconds: 0,
      calories: 0,
      steps: 13000,
    })
  })

  it('reads a null column as zero', () => {
    const rows = [row({ entry_date: '2026-09-21', calories_burnt: null, steps: null })]

    expect(weekTotals(rows)).toEqual(EMPTY)
  })

  it('totals a week that crosses a month boundary', () => {
    const rows = [
      row({ entry_date: '2026-09-28', gym_seconds: 1000, steps: 1 }),
      row({ entry_date: '2026-09-30', gym_seconds: 2000, steps: 2 }),
      row({ entry_date: '2026-10-01', gym_seconds: 3000, steps: 4 }),
      row({ entry_date: '2026-10-04', gym_seconds: 4000, steps: 8 }),
    ]

    expect(weekTotals(rows, { from: '2026-09-28', to: '2026-10-04' })).toEqual({
      sessions: 4,
      gymSeconds: 10000,
      walkSeconds: 0,
      calories: 0,
      steps: 15,
    })
  })

  it('leaves out a row before the range', () => {
    const rows = [
      row({ entry_date: '2026-09-27', gym_seconds: 9999 }),
      row({ entry_date: '2026-09-28', gym_seconds: 1000 }),
    ]

    expect(weekTotals(rows, { from: '2026-09-28', to: '2026-10-04' }).gymSeconds).toBe(1000)
  })

  it('leaves out a row after the range', () => {
    const rows = [
      row({ entry_date: '2026-10-04', gym_seconds: 1000 }),
      row({ entry_date: '2026-10-05', gym_seconds: 9999 }),
    ]

    expect(weekTotals(rows, { from: '2026-09-28', to: '2026-10-04' }).gymSeconds).toBe(1000)
  })

  it('totals every row when no range is given', () => {
    const rows = [
      row({ entry_date: '2025-01-01', gym_seconds: 1000 }),
      row({ entry_date: '2026-10-05', gym_seconds: 1000 }),
    ]

    expect(weekTotals(rows).gymSeconds).toBe(2000)
  })
})
