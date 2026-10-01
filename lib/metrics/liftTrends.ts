import { toDayNumber } from './day'
import { epley } from './epley'
import { roundTo2 } from './round'
import { volumeBySession } from './volumeLoad'

import type { LiftSet } from './volumeLoad'

export interface DatedSession {
  id: string
  entry_date: string
}

export interface SessionVolume {
  sessionId: string
  date: string
  volume: number
}

export function sessionVolumes(
  sessions: readonly DatedSession[],
  sets: readonly LiftSet[],
): SessionVolume[] {
  const totals = volumeBySession(sets)

  return sessions.map((session) => ({
    sessionId: session.id,
    date: session.entry_date,
    volume: totals[session.id] ?? 0,
  }))
}

export function volumeBetween(volumes: readonly SessionVolume[], from: string, to: string): number {
  return roundTo2(
    volumes.reduce(
      (total, item) => (item.date >= from && item.date <= to ? total + item.volume : total),
      0,
    ),
  )
}

export function weekChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return null
  }

  return Math.round(((current - previous) / previous) * 100)
}

const MS_PER_DAY = 86400000

function dateOf(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

export function weekToDateChange(volumes: readonly SessionVolume[], today: string): number | null {
  const day = toDayNumber(today)

  if (day === null) {
    return null
  }

  const monday = day - ((((day + 3) % 7) + 7) % 7)

  return weekChange(
    volumeBetween(volumes, dateOf(monday), today),
    volumeBetween(volumes, dateOf(monday - 7), dateOf(day - 7)),
  )
}

function estimate(set: LiftSet): number | null {
  if (set.deleted_at !== null) {
    return null
  }

  const value = epley(set.weight_kg, set.reps)

  return value !== null && value > 0 ? value : null
}

function bestBy(
  sets: readonly LiftSet[],
  key: (set: LiftSet) => string | null,
): Record<string, number> {
  const best: Record<string, number> = {}

  for (const set of sets) {
    const group = key(set)
    const value = estimate(set)

    if (group !== null && value !== null && value > (best[group] ?? 0)) {
      best[group] = value
    }
  }

  return best
}

export function oneRepMaxBySession(
  sets: readonly LiftSet[],
  exerciseId: string,
): Record<string, number> {
  return bestBy(sets, (set) => (set.exercise_id === exerciseId ? set.session_id : null))
}

export function bestOneRepMax(sets: readonly LiftSet[]): Record<string, number> {
  return bestBy(sets, (set) => set.exercise_id)
}
