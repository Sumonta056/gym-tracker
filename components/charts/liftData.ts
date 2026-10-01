import {
  bestOneRepMax,
  oneRepMaxBySession,
  sessionVolumes,
  weekToDateChange,
} from '../../lib/metrics/liftTrends'
import { personalRecords } from '../../lib/metrics/personalRecords'

import { dayTick, rangeFor } from './rangeData'

import type { RangeTab } from './rangeData'
import type { Exercise, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
import type { SessionVolume } from '../../lib/metrics/liftTrends'
import type { WeekRange } from '../../lib/metrics/weekTotals'

export type SessionSlot = {
  id: string
  date: string
}

export type LiftOption = {
  id: string
  name: string
  points: Record<string, number>
}

export type LiftRecord = {
  exerciseId: string
  name: string
  loadKg: number
  reps: number
  at: string
  volumeKg: number
  oneRepMaxKg: number | null
}

export type LiftAnalytics = {
  tab: RangeTab
  today: string
  range: WeekRange
  sessions: SessionSlot[]
  volumes: SessionVolume[]
  weekChange: number | null
  options: LiftOption[]
  records: LiftRecord[]
}

export const MAX_PICKED = 3

export const DEFAULT_PICKED = 2

export const MAX_SESSION_TICKS = 6

function inRange(date: string, range: WeekRange): boolean {
  return date >= range.from && date <= range.to
}

function byName(left: { name: string; id: string }, right: { name: string; id: string }): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
}

export function liftOptions(
  slots: readonly SessionSlot[],
  sets: readonly WorkoutSet[],
  names: ReadonlyMap<string, string>,
): LiftOption[] {
  const inSlots = new Set(slots.map((slot) => slot.id))
  const ranged = sets.filter((set) => inSlots.has(set.session_id))
  const options: LiftOption[] = []

  for (const [id, name] of names) {
    const points = oneRepMaxBySession(ranged, id)

    if (Object.keys(points).length > 0) {
      options.push({ id, name, points })
    }
  }

  return options.sort(
    (left, right) =>
      Object.keys(right.points).length - Object.keys(left.points).length || byName(left, right),
  )
}

export function liftRecords(
  sets: readonly WorkoutSet[],
  names: ReadonlyMap<string, string>,
): LiftRecord[] {
  const records = personalRecords(sets)
  const estimates = bestOneRepMax(sets)
  const list: LiftRecord[] = []

  for (const [exerciseId, record] of Object.entries(records)) {
    const name = names.get(exerciseId)
    const { bestLoad, bestVolume } = record

    if (name === undefined || bestLoad === null || bestVolume === null) {
      continue
    }

    list.push({
      exerciseId,
      name,
      loadKg: bestLoad.weightKg,
      reps: bestLoad.reps,
      at: bestLoad.at,
      volumeKg: bestVolume.volume,
      oneRepMaxKg: estimates[exerciseId] ?? null,
    })
  }

  return list.sort((left, right) =>
    byName({ name: left.name, id: left.exerciseId }, { name: right.name, id: right.exerciseId }),
  )
}

export function analyseLifts(
  sessions: readonly WorkoutSession[],
  sets: readonly WorkoutSet[],
  exercises: readonly Exercise[],
  tab: RangeTab,
  today: string,
): LiftAnalytics {
  const range = rangeFor(tab, today)
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
  const slots = sessions
    .filter((session) => inRange(session.entry_date, range))
    .map((session) => ({ id: session.id, date: session.entry_date }))
  const all = sessionVolumes(sessions, sets)

  return {
    tab,
    today,
    range,
    sessions: slots,
    volumes: all.filter((item) => inRange(item.date, range)),
    weekChange: weekToDateChange(all, today),
    options: liftOptions(slots, sets, names),
    records: liftRecords(sets, names),
  }
}

export function sessionTick(date: string): string {
  return dayTick(date, 'day')
}

export function sessionTicks(ids: readonly string[]): string[] {
  const step = Math.ceil(ids.length / MAX_SESSION_TICKS)

  return ids.filter((_, index) => index % step === 0)
}

export type PickSlots = (string | null)[]

export function pickedCount(picked: readonly (string | null)[]): number {
  return picked.filter((id) => id !== null).length
}

export function togglePicked(picked: readonly (string | null)[], id: string): PickSlots {
  if (picked.includes(id)) {
    return picked.map((item) => (item === id ? null : item))
  }

  const free = picked.indexOf(null)

  if (free >= 0) {
    return picked.map((item, index) => (index === free ? id : item))
  }

  return picked.length >= MAX_PICKED ? [...picked] : [...picked, id]
}

export function shownPicked(
  options: readonly LiftOption[],
  picked: readonly (string | null)[] | null,
): PickSlots {
  const fallback = options.slice(0, DEFAULT_PICKED).map((option) => option.id)

  if (picked === null) {
    return fallback
  }

  const available = new Set(options.map((option) => option.id))
  const kept = picked.map((id) => (id !== null && available.has(id) ? id : null))

  return pickedCount(kept) === 0 && pickedCount(picked) > 0 ? fallback : kept
}
