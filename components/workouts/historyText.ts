import { formatDuration } from '../../lib/duration'
import { formatLoadShort, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { prettyDate } from '../DailyEntryForm'
import { formatCount } from '../dashboard/summary'
import { startedText } from '../workout/SessionTimer'

import type { WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
import type { SessionStats } from '../../lib/metrics/sessionStats'
import type { MuscleGroup } from '../../lib/schema/exercise'
import type { UnitSystem } from '../../lib/schema/profile'

export const WORKOUTS_PATH = '/workouts'

export function sessionPath(id: string): string {
  return `${WORKOUTS_PATH}?session=${encodeURIComponent(id)}`
}

export function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`
}

export function volumeDisplay(kg: number, unit: UnitSystem): string {
  return `${formatCount(Math.round(toDisplayWeight(kg, unit)))} ${weightSymbol(unit)}`
}

export function rowTitle(session: WorkoutSession): string {
  return `${prettyDate(session.entry_date)} · ${startedText(session.started_at)}`
}

export function rowLine(stats: SessionStats, unit: UnitSystem): string {
  return `${formatDuration(stats.durationSeconds, 'short')} · ${plural(stats.setCount, 'set')} · ${volumeDisplay(stats.volumeKg, unit)}`
}

export function setText(set: WorkoutSet, unit: UnitSystem): string {
  if (set.weight_kg === null) {
    return plural(set.reps, 'rep')
  }

  return `${String(set.reps)} × ${formatLoadShort(set.weight_kg, unit)} ${weightSymbol(unit)}`
}

export type ExerciseGroup = { exerciseId: string; sets: WorkoutSet[] }

export function byExercise(sets: readonly WorkoutSet[]): ExerciseGroup[] {
  const groups = new Map<string, WorkoutSet[]>()

  for (const set of sets) {
    groups.set(set.exercise_id, [...(groups.get(set.exercise_id) ?? []), set])
  }

  return [...groups].map(([exerciseId, grouped]) => ({ exerciseId, sets: grouped }))
}

export const EMPTY_ROW = 'Empty session · no sets logged'

export const DELETE_HINT = 'It goes from all your devices after the next sync.'

function atNoon(date: string): Date {
  return new Date(`${date}T12:00:00Z`)
}

export function monthLabel(date: string): string {
  return atNoon(date).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function dayNumber(date: string): string {
  return String(atNoon(date).getUTCDate())
}

export function weekday(date: string): string {
  return atNoon(date).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
}

export function dayTitle(date: string): string {
  return prettyDate(date)
}

export function sessionsText(count: number): string {
  return plural(count, 'session')
}

export function recordsText(count: number): string {
  return plural(count, 'PR')
}

export function groupName(group: MuscleGroup): string {
  return `${group.charAt(0).toUpperCase()}${group.slice(1)}`
}

export function rowDetail(stats: SessionStats, groups: readonly MuscleGroup[]): string {
  if (stats.setCount === 0) {
    return EMPTY_ROW
  }

  const parts = [formatDuration(stats.durationSeconds, 'short'), plural(stats.setCount, 'set')]

  if (groups.length > 0) {
    parts.push(groups.map(groupName).join(', '))
  }

  return parts.join(' · ')
}

export function deleteLabel(session: WorkoutSession): string {
  return `Delete the session of ${prettyDate(session.entry_date)} at ${startedText(session.started_at)}`
}

export function deleteBody(setCount: number): string {
  const subject =
    setCount === 0 ? 'The session goes' : `The session and its ${plural(setCount, 'set')} go`

  return `${subject} from this device and from every other device after the next sync.`
}

export function groupsOf(
  sets: readonly WorkoutSet[],
  groupOf: ReadonlyMap<string, MuscleGroup>,
): MuscleGroup[] {
  const seen = new Set<MuscleGroup>()

  for (const set of sets) {
    const group = groupOf.get(set.exercise_id)

    if (group !== undefined) {
      seen.add(group)
    }
  }

  return [...seen]
}

export type DayGroup<Row> = { date: string; rows: Row[] }

export type MonthGroup<Row> = { label: string; count: number; days: DayGroup<Row>[] }

export function byMonthAndDay<Row extends { session: WorkoutSession }>(
  rows: readonly Row[],
): MonthGroup<Row>[] {
  const months: MonthGroup<Row>[] = []

  for (const row of rows) {
    const date = row.session.entry_date
    const label = monthLabel(date)
    let month = months.at(-1)

    if (month?.label !== label) {
      month = { label, count: 0, days: [] }
      months.push(month)
    }

    month.count += 1
    let day = month.days.at(-1)

    if (day?.date !== date) {
      day = { date, rows: [] }
      month.days.push(day)
    }

    day.rows.push(row)
  }

  return months
}
