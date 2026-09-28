import { roundTo2 } from './round'

import type { WorkoutSetInput } from '../schema/workoutSet'

export type LiftSet = Pick<
  WorkoutSetInput,
  'session_id' | 'exercise_id' | 'reps' | 'weight_kg' | 'completed_at'
> & {
  id: string
  created_at: string
  deleted_at: string | null
}

export function setVolume(set: LiftSet): number {
  if (set.deleted_at !== null || set.reps < 1) {
    return 0
  }

  return roundTo2(set.reps * (set.weight_kg ?? 0))
}

export function volumeLoad(sets: readonly LiftSet[]): number {
  return roundTo2(sets.reduce((total, set) => total + setVolume(set), 0))
}

function volumeBy(
  sets: readonly LiftSet[],
  key: 'session_id' | 'exercise_id',
): Record<string, number> {
  const totals: Record<string, number> = {}

  for (const set of sets) {
    if (set.deleted_at !== null) {
      continue
    }

    totals[set[key]] = roundTo2((totals[set[key]] ?? 0) + setVolume(set))
  }

  return totals
}

export function volumeBySession(sets: readonly LiftSet[]): Record<string, number> {
  return volumeBy(sets, 'session_id')
}

export function volumeByExercise(sets: readonly LiftSet[]): Record<string, number> {
  return volumeBy(sets, 'exercise_id')
}
