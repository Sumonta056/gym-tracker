import { roundTo2 } from './round'

import type { DailyEntryInput } from '../schema/dailyEntry'

export type CalorieRow = Pick<DailyEntryInput, 'entry_date' | 'gym_seconds' | 'calories_burnt'>

export interface CaloriePoint {
  date: string
  value: number | null
}

function rate(row: CalorieRow): number | null {
  const seconds = row.gym_seconds ?? 0

  if (row.calories_burnt === null || seconds <= 0) {
    return null
  }

  return roundTo2(row.calories_burnt / (seconds / 60))
}

export function caloriesPerMinute(rows: readonly CalorieRow[]): CaloriePoint[] {
  return [...rows]
    .sort((left, right) => left.entry_date.localeCompare(right.entry_date))
    .map((row) => ({ date: row.entry_date, value: rate(row) }))
}
