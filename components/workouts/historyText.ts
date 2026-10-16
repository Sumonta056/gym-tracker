import { formatDuration } from '../../lib/duration'
import { formatLoadShort, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { prettyDate } from '../DailyEntryForm'
import { formatCount } from '../dashboard/summary'
import { startedText } from '../workout/SessionTimer'

import type { WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
import type { SessionStats } from '../../lib/metrics/sessionStats'
import type { UnitSystem } from '../../lib/schema/profile'

export const WORKOUTS_PATH = '/workouts'

export function sessionPath(id: string): string {
  return `${WORKOUTS_PATH}?session=${encodeURIComponent(id)}`
}

function plural(count: number, word: string): string {
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
