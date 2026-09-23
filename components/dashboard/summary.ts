import { toDayNumber } from '../../lib/metrics/day'
import { heartRateZones } from '../../lib/metrics/heartRateZones'
import { streak } from '../../lib/metrics/streak'
import { weekTotals } from '../../lib/metrics/weekTotals'

import type { DailyEntry, Profile } from '../../lib/db/dexie'
import type { HeartRateZones } from '../../lib/metrics/heartRateZones'
import type { WeekRange, WeekTotals } from '../../lib/metrics/weekTotals'

const MS_PER_DAY = 86400000

export const WEIGHT_TREND_DAYS = 14

export const HISTORY_START = '0000-01-01'

export type DashboardSummary = {
  today: string
  entry: DailyEntry | undefined
  streak: number
  zones: HeartRateZones
  week: WeekTotals
  weekRange: WeekRange
  stepGoal: number
  latestWeightKg: number | null
  weightTrend: number[]
  displayName: string | null
}

function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

export function weekOf(date: string): WeekRange {
  const day = toDayNumber(date) ?? 0
  const sinceMonday = (((day + 3) % 7) + 7) % 7
  const monday = day - sinceMonday

  return { from: fromDayNumber(monday), to: fromDayNumber(monday + 6) }
}

export function daysBefore(date: string, days: number): string {
  return fromDayNumber((toDayNumber(date) ?? 0) - days)
}

export function summarise(
  entries: readonly DailyEntry[],
  profile: Profile,
  today: string,
  now: Date,
): DashboardSummary {
  const past = entries
    .filter((row) => row.entry_date <= today)
    .sort((left, right) => left.entry_date.localeCompare(right.entry_date))
  const entry = past.find((row) => row.entry_date === today)
  const weekRange = weekOf(today)
  const trendStart = daysBefore(today, WEIGHT_TREND_DAYS - 1)
  const weights = past.flatMap((row) =>
    row.weight_kg === null ? [] : [{ date: row.entry_date, kg: row.weight_kg }],
  )
  const latest = weights.at(-1)

  return {
    today,
    entry,
    streak: streak(
      past.map((row) => row.entry_date),
      now,
    ).current,
    zones: heartRateZones(
      entry ?? { gym_seconds: null, avg_heart_rate: null, max_heart_rate: null },
    ),
    week: weekTotals(past, weekRange),
    weekRange,
    stepGoal: profile.step_goal,
    latestWeightKg: latest?.kg ?? null,
    weightTrend: weights.filter((row) => row.date >= trendStart).map((row) => row.kg),
    displayName: profile.display_name,
  }
}

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' })

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

export function headerDate(date: string): { weekday: string; dayMonth: string } {
  const at = new Date(`${date}T00:00:00Z`)

  return { weekday: WEEKDAY.format(at), dayMonth: DAY_MONTH.format(at) }
}

const COUNT = new Intl.NumberFormat('en-GB')

export function formatCount(value: number): string {
  return COUNT.format(value)
}
