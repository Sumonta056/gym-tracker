import { describe, expect, it } from 'vitest'

import { DEFAULT_BALANCE_THRESHOLD, muscleBalance } from './muscleBalance'

import type { LiftSet } from './volumeLoad'
import type { MuscleGroup } from '../schema/exercise'

const BENCH = '00000000-0000-4000-8000-0000000000b1'
const ROW = '00000000-0000-4000-8000-0000000000b2'
const SQUAT = '00000000-0000-4000-8000-0000000000b3'
const PRESS = '00000000-0000-4000-8000-0000000000b4'
const UNKNOWN = '00000000-0000-4000-8000-0000000000ff'

const GROUPS: Record<string, MuscleGroup> = {
  [BENCH]: 'chest',
  [ROW]: 'back',
  [SQUAT]: 'legs',
  [PRESS]: 'shoulders',
}

function set(
  id: string,
  exerciseId: string,
  volume: number,
  fields: Partial<LiftSet> = {},
): LiftSet {
  return {
    id,
    session_id: '00000000-0000-4000-8000-00000000000a',
    exercise_id: exerciseId,
    reps: 1,
    weight_kg: volume,
    completed_at: null,
    created_at: '2026-09-20T08:00:00.000Z',
    deleted_at: null,
    ...fields,
  }
}

function sumOfShares(result: ReturnType<typeof muscleBalance>): number {
  return result.shares.reduce((total, share) => total + share.share, 0)
}

describe('muscleBalance', () => {
  it('returns an empty result for an empty week', () => {
    expect(muscleBalance([], GROUPS)).toEqual({ shares: [], below: [] })
  })

  it('returns an empty result when every set has no volume', () => {
    const sets = [set('s1', BENCH, 0), set('s2', ROW, 50, { reps: 0 })]

    expect(muscleBalance(sets, GROUPS)).toEqual({ shares: [], below: [] })
  })

  it('gives one group 100 percent when it holds all the volume', () => {
    expect(muscleBalance([set('s1', BENCH, 400)], GROUPS).shares).toEqual([
      { group: 'chest', volume: 400, share: 100 },
    ])
  })

  it('splits the volume into whole percent shares in the muscle group order', () => {
    const sets = [set('s1', SQUAT, 300), set('s2', BENCH, 500), set('s3', ROW, 200)]

    expect(muscleBalance(sets, GROUPS).shares).toEqual([
      { group: 'chest', volume: 500, share: 50 },
      { group: 'back', volume: 200, share: 20 },
      { group: 'legs', volume: 300, share: 30 },
    ])
  })

  it('keeps the sum at 100 when plain rounding would give 99', () => {
    const sets = [set('s1', BENCH, 100), set('s2', ROW, 100), set('s3', SQUAT, 100)]
    const result = muscleBalance(sets, GROUPS)

    expect(result.shares.map((share) => share.share)).toEqual([34, 33, 33])
    expect(sumOfShares(result)).toBe(100)
  })

  it('keeps the sum at 100 when plain rounding would give 101', () => {
    const sets = [set('s1', BENCH, 505), set('s2', ROW, 495)]
    const result = muscleBalance(sets, GROUPS)

    expect(result.shares.map((share) => share.share)).toEqual([51, 49])
    expect(sumOfShares(result)).toBe(100)
  })

  it('gives the spare point to the largest remainder, not the first group', () => {
    const sets = [set('s1', BENCH, 331), set('s2', ROW, 336), set('s3', SQUAT, 333)]
    const result = muscleBalance(sets, GROUPS)

    expect(result.shares.map((share) => share.share)).toEqual([33, 34, 33])
    expect(sumOfShares(result)).toBe(100)
  })

  it('keeps the sum at 100 for an uneven split over four groups', () => {
    const sets = [set('s1', BENCH, 1), set('s2', ROW, 1), set('s3', SQUAT, 1), set('s4', PRESS, 3)]

    expect(sumOfShares(muscleBalance(sets, GROUPS))).toBe(100)
  })

  it('adds the volume of every set in one group', () => {
    const sets = [set('s1', BENCH, 100), set('s2', BENCH, 150), set('s3', ROW, 250)]

    expect(muscleBalance(sets, GROUPS).shares).toEqual([
      { group: 'chest', volume: 250, share: 50 },
      { group: 'back', volume: 250, share: 50 },
    ])
  })

  it('skips a soft-deleted set', () => {
    const sets = [
      set('s1', BENCH, 100),
      set('s2', ROW, 900, { deleted_at: '2026-09-20T09:00:00.000Z' }),
    ]

    expect(muscleBalance(sets, GROUPS).shares).toEqual([
      { group: 'chest', volume: 100, share: 100 },
    ])
  })

  it('skips a set whose exercise has no known muscle group', () => {
    const sets = [set('s1', BENCH, 100), set('s2', UNKNOWN, 900)]

    expect(muscleBalance(sets, GROUPS).shares).toEqual([
      { group: 'chest', volume: 100, share: 100 },
    ])
  })

  it('uses 15 percent as the default threshold', () => {
    expect(DEFAULT_BALANCE_THRESHOLD).toBe(15)
  })

  it('lists a group at 14 percent as below the threshold', () => {
    const sets = [set('s1', BENCH, 86), set('s2', ROW, 14)]

    expect(muscleBalance(sets, GROUPS).below).toEqual(['back'])
  })

  it('does not list a group at 15 percent as below the threshold', () => {
    const sets = [set('s1', BENCH, 85), set('s2', ROW, 15)]

    expect(muscleBalance(sets, GROUPS).below).toEqual([])
  })

  it('judges the threshold on the shown whole percent share', () => {
    const sets = [set('s1', BENCH, 853), set('s2', ROW, 147)]
    const result = muscleBalance(sets, GROUPS)

    expect(result.shares[1]?.share).toBe(15)
    expect(result.below).toEqual([])
  })

  it('takes a custom threshold', () => {
    const sets = [set('s1', BENCH, 75), set('s2', ROW, 25)]

    expect(muscleBalance(sets, GROUPS, 30).below).toEqual(['back'])
  })

  it('lists every group below the threshold in the muscle group order', () => {
    const sets = [set('s1', SQUAT, 5), set('s2', BENCH, 10), set('s3', ROW, 85)]

    expect(muscleBalance(sets, GROUPS).below).toEqual(['chest', 'legs'])
  })

  it('does not list a group with no volume as below the threshold', () => {
    const sets = [set('s1', BENCH, 100)]

    expect(muscleBalance(sets, GROUPS).below).toEqual([])
  })
})
