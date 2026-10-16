import { toDayNumber } from '../../lib/metrics/day'
import { effectiveGymSeconds } from '../../lib/metrics/gymTime'
import { heartRateZones, resolveMaxHeartRate } from '../../lib/metrics/heartRateZones'
import { roundTo2 } from '../../lib/metrics/round'
import { sessionStats } from '../../lib/metrics/sessionStats'
import { streak } from '../../lib/metrics/streak'
import { gymDates, weekTotals } from '../../lib/metrics/weekTotals'

import type { DailyEntry, Profile, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
import type { GymTimeSource } from '../../lib/metrics/gymTime'
import type { HeartRateZones, MaxHeartRate } from '../../lib/metrics/heartRateZones'
import type { SessionStats } from '../../lib/metrics/sessionStats'
import type { WeekRange, WeekTotals } from '../../lib/metrics/weekTotals'
import type { UnitSystem } from '../../lib/schema/profile'

const MS_PER_DAY = 86400000

export const WEIGHT_TREND_DAYS = 14

export const HISTORY_START = '0000-01-01'

export type TodayLifts = {
  sessions: WorkoutSession[]
  sets: WorkoutSet[]
  earlierSets: WorkoutSet[]
}

export const NO_LIFTS: TodayLifts = { sessions: [], sets: [], earlierSets: [] }

export type TodayWorkout = { session: WorkoutSession; stats: SessionStats }

export type TodayGym = { seconds: number; source: GymTimeSource }

export type DashboardSummary = {
  today: string
  entry: DailyEntry | undefined
  streak: number
  zones: HeartRateZones
  maxHeartRate: MaxHeartRate | null
  week: WeekTotals
  weekRange: WeekRange
  weekGymDates: string[]
  stepGoal: number
  latestWeightKg: number | null
  weightTrend: number[]
  displayName: string | null
  unitSystem: UnitSystem
  sessionsGoal: number | null
  gym: TodayGym
  workouts: TodayWorkout[]
  calorieGoal: number | null
  walkGoalSeconds: number | null
  targetWeightKg: number | null
  weightGapKg: number | null
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

export function todayWorkouts(lifts: TodayLifts, today: string): TodayWorkout[] {
  return lifts.sessions
    .filter(
      (session) =>
        session.entry_date === today && session.deleted_at === null && session.ended_at !== null,
    )
    .sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at))
    .map((session) => ({
      session,
      stats: sessionStats(session, lifts.sets, lifts.earlierSets),
    }))
}

export function weightGap(latestKg: number | null, targetKg: number | null): number | null {
  return latestKg === null || targetKg === null ? null : roundTo2(Math.abs(latestKg - targetKg))
}

export function summarise(
  entries: readonly DailyEntry[],
  profile: Profile,
  today: string,
  now: Date,
  lifts: TodayLifts = NO_LIFTS,
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
  const gym = effectiveGymSeconds(
    entry,
    lifts.sessions.filter((session) => session.entry_date === today),
  )
  const maxHeartRate = resolveMaxHeartRate(
    { max_heart_rate: profile.max_heart_rate ?? null, birth_year: profile.birth_year ?? null },
    today,
  )

  return {
    today,
    entry,
    streak: streak(
      past.map((row) => row.entry_date),
      now,
    ).current,
    zones: heartRateZones(
      {
        gym_seconds: gym.seconds,
        avg_heart_rate: entry?.avg_heart_rate ?? null,
        max_heart_rate: entry?.max_heart_rate ?? null,
      },
      maxHeartRate?.bpm ?? null,
    ),
    maxHeartRate,
    week: weekTotals(past, weekRange, lifts.sessions),
    weekRange,
    weekGymDates: gymDates(past, weekRange, lifts.sessions),
    stepGoal: profile.step_goal,
    latestWeightKg: latest?.kg ?? null,
    weightTrend: weights.filter((row) => row.date >= trendStart).map((row) => row.kg),
    displayName: profile.display_name,
    unitSystem: profile.unit_system,
    sessionsGoal: profile.sessions_per_week_goal ?? null,
    gym,
    workouts: todayWorkouts(lifts, today),
    calorieGoal: profile.calorie_goal ?? null,
    walkGoalSeconds: profile.walk_goal_seconds ?? null,
    targetWeightKg: profile.target_weight_kg,
    weightGapKg: weightGap(latest?.kg ?? null, profile.target_weight_kg),
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

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function dayMonthShort(date: string): { day: string; month: string } {
  return {
    day: String(Number(date.slice(8, 10))),
    month: SHORT_MONTHS[Number(date.slice(5, 7)) - 1] ?? '',
  }
}

export function weekRangeLabel(range: WeekRange): string {
  const from = dayMonthShort(range.from)
  const to = dayMonthShort(range.to)

  if (from.month === to.month) {
    return `${from.day} – ${to.day} ${to.month}`
  }

  return `${from.day} ${from.month} – ${to.day} ${to.month}`
}
