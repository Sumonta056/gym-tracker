import { MUSCLE_GROUPS } from '../schema/exercise'

import { roundTo2 } from './round'
import { setVolume } from './volumeLoad'

import type { LiftSet } from './volumeLoad'
import type { MuscleGroup } from '../schema/exercise'

export const DEFAULT_BALANCE_THRESHOLD = 15

export interface MuscleShare {
  group: MuscleGroup
  volume: number
  share: number
}

export interface MuscleBalance {
  shares: MuscleShare[]
  below: MuscleGroup[]
}

interface GroupVolume {
  group: MuscleGroup
  volume: number
}

function volumeByGroup(
  sets: readonly LiftSet[],
  groups: Readonly<Record<string, MuscleGroup>>,
): GroupVolume[] {
  const totals = new Map<MuscleGroup, number>()

  for (const set of sets) {
    const group = groups[set.exercise_id]
    const volume = setVolume(set)

    if (group !== undefined && volume > 0) {
      totals.set(group, roundTo2((totals.get(group) ?? 0) + volume))
    }
  }

  return MUSCLE_GROUPS.flatMap((group) => {
    const volume = totals.get(group)

    return volume === undefined ? [] : [{ group, volume }]
  })
}

function largestRemainder(volumes: readonly GroupVolume[], total: number): MuscleShare[] {
  const exact = volumes.map((entry, index) => {
    const percent = (entry.volume * 100) / total
    const share = Math.floor(percent)

    return { ...entry, share, remainder: percent - share, index }
  })
  const spare = 100 - exact.reduce((sum, entry) => sum + entry.share, 0)
  const winners = new Set(
    [...exact]
      .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
      .slice(0, spare)
      .map((entry) => entry.index),
  )

  return exact.map(({ group, volume, share, index }) => ({
    group,
    volume,
    share: winners.has(index) ? share + 1 : share,
  }))
}

export function muscleBalance(
  sets: readonly LiftSet[],
  groups: Readonly<Record<string, MuscleGroup>>,
  threshold: number = DEFAULT_BALANCE_THRESHOLD,
): MuscleBalance {
  const volumes = volumeByGroup(sets, groups)
  const total = volumes.reduce((sum, entry) => sum + entry.volume, 0)

  if (volumes.length === 0) {
    return { shares: [], below: [] }
  }

  const shares = largestRemainder(volumes, total)

  return {
    shares,
    below: shares.filter((entry) => entry.share < threshold).map((entry) => entry.group),
  }
}
