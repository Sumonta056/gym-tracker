import type { DailyEntryInput } from '../schema/dailyEntry'

export type WeekRow = Pick<
  DailyEntryInput,
  'entry_date' | 'gym_seconds' | 'walk_seconds' | 'calories_burnt' | 'steps'
>

export interface WeekRange {
  from: string
  to: string
}

export interface WeekTotals {
  sessions: number
  gymSeconds: number
  walkSeconds: number
  calories: number
  steps: number
}

function inRange(row: WeekRow, range: WeekRange | undefined): boolean {
  return range === undefined || (row.entry_date >= range.from && row.entry_date <= range.to)
}

export function weekTotals(rows: readonly WeekRow[], range?: WeekRange): WeekTotals {
  const totals: WeekTotals = {
    sessions: 0,
    gymSeconds: 0,
    walkSeconds: 0,
    calories: 0,
    steps: 0,
  }

  for (const row of rows) {
    if (!inRange(row, range)) {
      continue
    }

    const gym = row.gym_seconds ?? 0

    totals.sessions += gym > 0 ? 1 : 0
    totals.gymSeconds += gym
    totals.walkSeconds += row.walk_seconds ?? 0
    totals.calories += row.calories_burnt ?? 0
    totals.steps += row.steps ?? 0
  }

  return totals
}
