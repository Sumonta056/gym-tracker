import { setVolume } from './volumeLoad'

import type { LiftSet } from './volumeLoad'

export interface LoadRecord {
  setId: string
  weightKg: number
  reps: number
  at: string
}

export interface VolumeRecord {
  setId: string
  volume: number
  at: string
}

export interface PersonalRecord {
  bestLoad: LoadRecord | null
  bestVolume: VolumeRecord | null
}

function dateOf(set: LiftSet): string {
  return set.completed_at ?? set.created_at
}

export type OrderedLiftSet = LiftSet & { set_index?: number }

export function earlierThan(left: OrderedLiftSet, right: OrderedLiftSet): boolean {
  return (
    (Date.parse(dateOf(left)) - Date.parse(dateOf(right)) ||
      Date.parse(left.created_at) - Date.parse(right.created_at) ||
      (left.set_index ?? 0) - (right.set_index ?? 0) ||
      left.id.localeCompare(right.id)) < 0
  )
}

interface Mark {
  value: number
  at: string
}

function beats(candidate: Mark, best: Mark | null): boolean {
  if (best === null || candidate.value > best.value) {
    return true
  }

  return candidate.value === best.value && Date.parse(candidate.at) < Date.parse(best.at)
}

export function personalRecords(sets: readonly LiftSet[]): Record<string, PersonalRecord> {
  const records: Record<string, PersonalRecord> = {}

  for (const set of sets) {
    if (set.deleted_at !== null) {
      continue
    }

    const record = records[set.exercise_id] ?? { bestLoad: null, bestVolume: null }
    records[set.exercise_id] = record

    if (set.weight_kg === null) {
      continue
    }

    const at = dateOf(set)
    const volume = setVolume(set)
    const { bestLoad, bestVolume } = record

    if (
      beats({ value: set.weight_kg, at }, bestLoad && { value: bestLoad.weightKg, at: bestLoad.at })
    ) {
      record.bestLoad = { setId: set.id, weightKg: set.weight_kg, reps: set.reps, at }
    }

    if (
      beats({ value: volume, at }, bestVolume && { value: bestVolume.volume, at: bestVolume.at })
    ) {
      record.bestVolume = { setId: set.id, volume, at }
    }
  }

  return records
}

export function isNewRecord(set: OrderedLiftSet, history: readonly OrderedLiftSet[]): boolean {
  const weight = set.weight_kg

  if (set.deleted_at !== null || weight === null) {
    return false
  }

  const earlier = history.flatMap((item) =>
    item.exercise_id === set.exercise_id &&
    item.id !== set.id &&
    item.deleted_at === null &&
    item.weight_kg !== null &&
    earlierThan(item, set)
      ? [item.weight_kg]
      : [],
  )

  return earlier.length > 0 && earlier.every((earlierWeight) => weight > earlierWeight)
}
