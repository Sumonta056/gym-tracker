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

const MS_PER_DAY = 86_400_000
const DAYS_IN_WEEK = 7

function gymByDate(
  rows: readonly WeekRow[],
  range: WeekRange | undefined,
  sessions: readonly SessionRow[],
): Map<string, number> {
  const entries = new Map(
    rows.filter((row) => inRange(row.entry_date, range)).map((row) => [row.entry_date, row]),
  )
  const byDate = sessionsByDate(sessions.filter((session) => inRange(session.entry_date, range)))
  const gym = new Map<string, number>()

  for (const date of new Set([...entries.keys(), ...byDate.keys()])) {
    gym.set(date, effectiveGymSeconds(entries.get(date), byDate.get(date) ?? []).seconds)
  }

  return gym
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

  for (const row of rows.filter((item) => inRange(item.entry_date, range))) {
    totals.walkSeconds += row.walk_seconds ?? 0
    totals.calories += row.calories_burnt ?? 0
    totals.steps += row.steps ?? 0
  }

  for (const gym of gymByDate(rows, range, sessions).values()) {
    totals.gymSeconds += gym
    totals.sessions += gym > 0 ? 1 : 0
  }

  return totals
}

export function gymDates(
  rows: readonly WeekRow[],
  range: WeekRange,
  sessions: readonly SessionRow[],
): string[] {
  return [...gymByDate(rows, range, sessions)]
    .filter(([, gym]) => gym > 0)
    .map(([date]) => date)
    .sort()
}

export function weekDates(range: WeekRange): string[] {
  const start = Date.parse(`${range.from}T00:00:00.000Z`)

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) =>
    new Date(start + index * MS_PER_DAY).toISOString().slice(0, 10),
  )
}
