import { describe, expect, it } from 'vitest'

import { caloriesPerMinute } from './caloriesPerMinute'

import type { CalorieRow } from './caloriesPerMinute'

function row(fields: Partial<CalorieRow> & { entry_date: string }): CalorieRow {
  return { gym_seconds: 3600, calories_burnt: 600, ...fields }
}

describe('caloriesPerMinute', () => {
  it('returns an empty list for no rows', () => {
    expect(caloriesPerMinute([])).toEqual([])
  })

  it('divides the calories by the gym minutes', () => {
    expect(caloriesPerMinute([row({ entry_date: '2026-09-02' })])).toEqual([
      { date: '2026-09-02', value: 10 },
    ])
  })

  it('rounds the rate to two decimals', () => {
    const rows = [row({ entry_date: '2026-09-02', gym_seconds: 3062, calories_burnt: 613 })]

    expect(caloriesPerMinute(rows)[0]?.value).toBe(12.01)
  })

  it('returns null for zero gym minutes, never infinity', () => {
    const rows = [row({ entry_date: '2026-09-02', gym_seconds: 0 })]

    expect(caloriesPerMinute(rows)[0]?.value).toBeNull()
  })

  it('returns null for a null gym time', () => {
    const rows = [row({ entry_date: '2026-09-09', gym_seconds: null, calories_burnt: 629 })]

    expect(caloriesPerMinute(rows)[0]?.value).toBeNull()
  })

  it('returns null for a negative gym time', () => {
    const rows = [row({ entry_date: '2026-09-02', gym_seconds: -60 })]

    expect(caloriesPerMinute(rows)[0]?.value).toBeNull()
  })

  it('returns null for a null calorie value', () => {
    const rows = [row({ entry_date: '2026-09-02', calories_burnt: null })]

    expect(caloriesPerMinute(rows)[0]?.value).toBeNull()
  })

  it('returns 0 for zero calories over real gym minutes', () => {
    const rows = [row({ entry_date: '2026-09-02', calories_burnt: 0 })]

    expect(caloriesPerMinute(rows)[0]?.value).toBe(0)
  })

  it('returns one point per row, sorted by date', () => {
    const rows = [
      row({ entry_date: '2026-09-13', gym_seconds: 4325, calories_burnt: 963 }),
      row({ entry_date: '2026-09-02', gym_seconds: 3062, calories_burnt: 613 }),
      row({ entry_date: '2026-09-09', gym_seconds: null, calories_burnt: 629 }),
    ]

    expect(caloriesPerMinute(rows)).toEqual([
      { date: '2026-09-02', value: 12.01 },
      { date: '2026-09-09', value: null },
      { date: '2026-09-13', value: 13.36 },
    ])
  })

  it('does not reorder the rows it was given', () => {
    const rows = [row({ entry_date: '2026-09-13' }), row({ entry_date: '2026-09-02' })]

    caloriesPerMinute(rows)

    expect(rows.map((item) => item.entry_date)).toEqual(['2026-09-13', '2026-09-02'])
  })
})
