import { describe, expect, it } from 'vitest'

import { BENCH, LEG, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import { sessionStats } from './sessionStats'
import { volumeLoad } from './volumeLoad'

const TODAY = sessionOn('2026-09-23')
const EARLIER = sessionOn('2026-09-20')
const LATER = sessionOn('2026-09-25')
const DELETED = '2026-09-23T12:30:00.000Z'

describe('sessionStats', () => {
  it('counts the seconds from the start to the end', () => {
    expect(sessionStats(TODAY, [], []).durationSeconds).toBe(3600)
  })

  it('counts 0 seconds for a session that has not ended', () => {
    const running = sessionOn('2026-09-23', { ended_at: null, status: 'active' })

    expect(sessionStats(running, [], []).durationSeconds).toBe(0)
  })

  it('never counts a negative duration', () => {
    const broken = sessionOn('2026-09-23', { ended_at: '2026-09-23T11:00:00.000Z' })

    expect(sessionStats(broken, [], []).durationSeconds).toBe(0)
  })

  it('returns 0 sets, 0 exercises, 0 volume and no record for an empty session', () => {
    expect(sessionStats(TODAY, [], [])).toEqual({
      durationSeconds: 3600,
      setCount: 0,
      exerciseCount: 0,
      volumeKg: 0,
      newRecords: [],
    })
  })

  it('counts the live sets and the distinct exercises', () => {
    const sets = [
      liftSet(TODAY, BENCH, 10, 60),
      liftSet(TODAY, BENCH, 8, 65),
      liftSet(TODAY, LEG, 12, 120),
    ]

    expect(sessionStats(TODAY, sets, [])).toMatchObject({ setCount: 3, exerciseCount: 2 })
  })

  it('ignores a soft-deleted set', () => {
    const sets = [
      liftSet(TODAY, BENCH, 10, 60),
      liftSet(TODAY, LEG, 10, 100, { deleted_at: DELETED }),
    ]

    expect(sessionStats(TODAY, sets, [])).toMatchObject({
      setCount: 1,
      exerciseCount: 1,
      volumeKg: 600,
    })
  })

  it('ignores a set of another session', () => {
    const sets = [liftSet(TODAY, BENCH, 10, 60), liftSet(EARLIER, BENCH, 10, 80)]

    expect(sessionStats(TODAY, sets, [])).toMatchObject({ setCount: 1, volumeKg: 600 })
  })

  it('equals volumeLoad for the same sets', () => {
    const sets = [liftSet(TODAY, BENCH, 10, 60), liftSet(TODAY, BENCH, 8, 65)]

    expect(sessionStats(TODAY, sets, []).volumeKg).toBe(volumeLoad(sets))
  })

  it('adds 0 volume for a body-weight set and still counts it', () => {
    const sets = [liftSet(TODAY, BENCH, 15, null)]

    expect(sessionStats(TODAY, sets, [])).toMatchObject({ setCount: 1, volumeKg: 0 })
  })

  it('names a new record when the heaviest set beats the best earlier weight', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60)]
    const sets = [liftSet(TODAY, BENCH, 6, 62.5)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([
      { exerciseId: BENCH, weightKg: 62.5, reps: 6 },
    ])
  })

  it('gives 1 record per exercise, at its heaviest set', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60)]
    const sets = [
      liftSet(TODAY, BENCH, 6, 62.5),
      liftSet(TODAY, BENCH, 4, 65),
      liftSet(TODAY, BENCH, 8, 61),
    ]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([
      { exerciseId: BENCH, weightKg: 65, reps: 4 },
    ])
  })

  it('names no record for an exercise done for the first time', () => {
    const sets = [liftSet(TODAY, BENCH, 5, 40), liftSet(TODAY, BENCH, 5, 50)]

    expect(sessionStats(TODAY, sets, []).newRecords).toEqual([])
  })

  it('names no record when the heaviest set only equals the earlier best', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60)]
    const sets = [liftSet(TODAY, BENCH, 12, 60)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([])
  })

  it('ignores an earlier-list set that comes from a later session', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60), liftSet(LATER, BENCH, 3, 100)]
    const sets = [liftSet(TODAY, BENCH, 6, 62.5)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([
      { exerciseId: BENCH, weightKg: 62.5, reps: 6 },
    ])
  })

  it('times an earlier set with no completed_at by its created_at', () => {
    const earlier = [
      liftSet(EARLIER, BENCH, 8, 60, { completed_at: null }),
      liftSet(LATER, BENCH, 3, 100, { completed_at: null }),
    ]
    const sets = [liftSet(TODAY, BENCH, 6, 62.5)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([
      { exerciseId: BENCH, weightKg: 62.5, reps: 6 },
    ])
  })

  it('ignores a soft-deleted earlier set', () => {
    const earlier = [
      liftSet(EARLIER, BENCH, 3, 70, { deleted_at: '2026-09-21T08:00:00.000Z' }),
      liftSet(EARLIER, BENCH, 8, 60),
    ]
    const sets = [liftSet(TODAY, BENCH, 5, 65)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([
      { exerciseId: BENCH, weightKg: 65, reps: 5 },
    ])
  })

  it('ignores the sets of this session inside the earlier list', () => {
    const sets = [liftSet(TODAY, BENCH, 5, 60), liftSet(TODAY, BENCH, 5, 62.5)]

    expect(sessionStats(TODAY, sets, sets).newRecords).toEqual([])
  })

  it('names no record when every earlier set was body weight', () => {
    const earlier = [liftSet(EARLIER, BENCH, 15, null)]
    const sets = [liftSet(TODAY, BENCH, 10, 20)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([])
  })

  it('names no record for a body-weight set today', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60)]
    const sets = [liftSet(TODAY, BENCH, 15, null)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([])
  })
})
