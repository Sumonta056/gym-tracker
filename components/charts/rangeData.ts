import { toDayNumber } from '../../lib/metrics/day'
import { heartRateZones } from '../../lib/metrics/heartRateZones'
import { DEFAULT_WINDOW_DAYS, movingAverage } from '../../lib/metrics/movingAverage'
import { streak } from '../../lib/metrics/streak'
import { weekTotals } from '../../lib/metrics/weekTotals'
import { daysBefore, formatCount, weekOf } from '../dashboard/summary'

import type { DailyEntry } from '../../lib/db/dexie'
import type { HeartRateZones } from '../../lib/metrics/heartRateZones'
import type { Streak } from '../../lib/metrics/streak'
import type { WeekRange, WeekTotals } from '../../lib/metrics/weekTotals'

const MS_PER_DAY = 86400000

export type RangeTab = 'day' | 'week' | 'month'

export const RANGE_TABS: { value: RangeTab; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

export const HEAT_MAP_WEEKS = 12

export const PERIOD_WORD: Record<RangeTab, string> = {
  day: 'today',
  week: 'this week',
  month: 'this month',
}

export type DayPoint = {
  date: string
  logged: boolean
  weightKg: number | null
  averageKg: number | null
  calories: number | null
  steps: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
  gymSeconds: number | null
}

export type HeatCell = {
  date: string
  state: 'logged' | 'missed' | 'future'
}

export type HeatWeek = {
  start: string
  days: HeatCell[]
}

export type AnalyticsData = {
  tab: RangeTab
  today: string
  range: WeekRange
  label: string
  days: DayPoint[]
  zones: HeartRateZones
  totals: WeekTotals
  streak: Streak
  heatMap: HeatWeek[]
  stepGoal: number
}

export const MONTH_TICK_DAYS = ['01', '08', '15', '22', '29']

function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

function monthOf(date: string): WeekRange {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)

  return { from: `${date.slice(0, 7)}-01`, to: last }
}

export function rangeFor(tab: RangeTab, today: string): WeekRange {
  if (tab === 'day') {
    return { from: today, to: today }
  }

  return tab === 'week' ? weekOf(today) : monthOf(today)
}

export function readWindow(range: WeekRange): WeekRange {
  return { from: daysBefore(range.from, DEFAULT_WINDOW_DAYS - 1), to: range.to }
}

export function datesIn(range: WeekRange): string[] {
  const first = toDayNumber(range.from)

  if (first === null) {
    return []
  }

  const last = toDayNumber(range.to) ?? first
  const dates: string[] = []

  for (let day = first; day <= last; day += 1) {
    dates.push(fromDayNumber(day))
  }

  return dates
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' })

const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

function at(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

export function rangeLabel(range: WeekRange): string {
  const end = DAY_MONTH.format(at(range.to))

  if (range.from === range.to) {
    return end
  }

  const start =
    range.from.slice(0, 7) === range.to.slice(0, 7)
      ? DAY.format(at(range.from))
      : DAY_MONTH.format(at(range.from))

  return `${start} – ${end}`
}

export function heatMapFor(logged: ReadonlySet<string>, today: string): HeatWeek[] {
  const lastWeek = weekOf(today)
  const firstMonday = daysBefore(lastWeek.from, (HEAT_MAP_WEEKS - 1) * 7)
  const dates = datesIn({ from: firstMonday, to: lastWeek.to })
  const weeks: HeatWeek[] = []

  for (let index = 0; index < dates.length; index += 7) {
    const days = dates.slice(index, index + 7).map((date): HeatCell => {
      if (date > today) {
        return { date, state: 'future' }
      }

      return { date, state: logged.has(date) ? 'logged' : 'missed' }
    })

    weeks.push({ start: days[0]?.date ?? '', days })
  }

  return weeks
}

export function analyse(
  entries: readonly DailyEntry[],
  history: readonly DailyEntry[],
  tab: RangeTab,
  today: string,
  now: Date,
  stepGoal: number,
): AnalyticsData {
  const range = rangeFor(tab, today)
  const byDate = new Map(entries.map((row) => [row.entry_date, row]))
  const averages = new Map(
    movingAverage(entries.map((row) => ({ date: row.entry_date, value: row.weight_kg }))).map(
      (point) => [point.date, point.average],
    ),
  )
  const days = datesIn(range).map((date): DayPoint => {
    const row = byDate.get(date)

    return {
      date,
      logged: row !== undefined,
      weightKg: row?.weight_kg ?? null,
      averageKg: row === undefined ? null : (averages.get(date) ?? null),
      calories: row?.calories_burnt ?? null,
      steps: row?.steps ?? null,
      avgHeartRate: row?.avg_heart_rate ?? null,
      maxHeartRate: row?.max_heart_rate ?? null,
      gymSeconds: row?.gym_seconds ?? null,
    }
  })
  const past = history.filter((row) => row.entry_date <= today)
  const todayEntry = byDate.get(today)

  return {
    tab,
    today,
    range,
    label: rangeLabel(range),
    days,
    zones: heartRateZones(
      todayEntry ?? { gym_seconds: null, avg_heart_rate: null, max_heart_rate: null },
    ),
    totals: weekTotals(entries, range),
    streak: streak(
      past.map((row) => row.entry_date),
      now,
    ),
    heatMap: heatMapFor(new Set(past.map((row) => row.entry_date)), today),
    stepGoal,
  }
}

export function presentValues(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null)
}

export function trendWord(values: readonly number[]): string {
  const first = values[0]
  const last = values.at(-1)

  if (first === undefined || last === undefined || values.length < 2) {
    return 'one day logged'
  }

  if (last > first) {
    return 'rising'
  }

  return last < first ? 'falling' : 'steady'
}

export function formatKg(value: number): string {
  return value.toFixed(1)
}

export function signedKg(value: number): string {
  if (value > 0) {
    return `+${formatKg(value)}`
  }

  return value < 0 ? `−${formatKg(-value)}` : formatKg(0)
}

export function countList(values: readonly number[]): string {
  return values.map(formatCount).join(', ')
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function dayTick(date: string, tab: RangeTab): string {
  const day = at(date)

  if (tab === 'week') {
    return WEEKDAY_SHORT.format(day).charAt(0)
  }

  if (tab === 'day') {
    return `${WEEKDAY_SHORT.format(day)} ${DAY.format(day)}`
  }

  return MONTH_TICK_DAYS.includes(date.slice(8, 10)) ? DAY.format(day) : ''
}

export function tickDates(days: readonly DayPoint[], tab: RangeTab): string[] {
  return days.map((day) => day.date).filter((date) => dayTick(date, tab) !== '')
}

export function loggedDays(days: readonly DayPoint[]): number {
  return days.filter((day) => day.logged).length
}

export function averagePerLoggedDay(total: number, logged: number): number | null {
  return logged < 2 ? null : total / logged
}

export function highestIndex(values: readonly (number | null)[]): number {
  let best = -1
  let top = -Infinity

  values.forEach((value, index) => {
    if (value !== null && value > top) {
      top = value
      best = index
    }
  })

  return best
}

export function lastIndex(values: readonly (number | null)[]): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) {
      return index
    }
  }

  return -1
}
