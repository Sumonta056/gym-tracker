import { effectiveGymSeconds } from './gymTime'
import { sessionsByDate } from './sessionDays'

import type { SessionRow } from './sessionDays'
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

function inRange(date: string, range: WeekRange | undefined): boolean {
  return range === undefined || (date >= range.from && date <= range.to)
}

export function weekTotals(
  rows: readonly WeekRow[],
  range?: WeekRange,
  sessions: readonly SessionRow[] = [],
): WeekTotals {
  const totals: WeekTotals = {
    sessions: 0,
    gymSeconds: 0,
    walkSeconds: 0,
    calories: 0,
    steps: 0,
  }
  const inside = rows.filter((row) => inRange(row.entry_date, range))
  const entries = new Map(inside.map((row) => [row.entry_date, row]))
  const byDate = sessionsByDate(sessions.filter((session) => inRange(session.entry_date, range)))

  for (const row of inside) {
    totals.walkSeconds += row.walk_seconds ?? 0
    totals.calories += row.calories_burnt ?? 0
    totals.steps += row.steps ?? 0
  }

  for (const date of new Set([...entries.keys(), ...byDate.keys()])) {
    const gym = effectiveGymSeconds(entries.get(date), byDate.get(date) ?? []).seconds

    totals.gymSeconds += gym
    totals.sessions += gym > 0 ? 1 : 0
  }

  return totals
}
