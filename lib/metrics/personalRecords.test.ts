import { describe, expect, it } from 'vitest'

import { earlierThan, isNewRecord, personalRecords } from './personalRecords'

import type { LiftSet } from './volumeLoad'

const SESSION = '00000000-0000-4000-8000-00000000000a'
const BENCH = '00000000-0000-4000-8000-0000000000b1'
const SQUAT = '00000000-0000-4000-8000-0000000000c1'
const DELETED = '2026-09-25T09:00:00.000Z'

function set(fields: Partial<LiftSet> & { id: string }): LiftSet {
  return {
    session_id: SESSION,
    exercise_id: BENCH,
    reps: 10,
    weight_kg: 40,
    completed_at: null,
    created_at: '2026-09-20T08:00:00.000Z',
    deleted_at: null,
    ...fields,
  }
}

describe('personalRecords', () => {
  it('returns an empty result for no sets', () => {
    expect(personalRecords([])).toEqual({})
  })

  it('finds the heaviest load and the biggest set volume for an exercise', () => {
    const sets = [
      set({ id: 'heavy', reps: 3, weight_kg: 80, completed_at: '2026-09-21T08:00:00.000Z' }),
      set({ id: 'volume', reps: 12, weight_kg: 60, completed_at: '2026-09-22T08:00:00.000Z' }),
    ]

    expect(personalRecords(sets)).toEqual({
      [BENCH]: {
        bestLoad: {
          setId: 'heavy',
          weightKg: 80,
          reps: 3,
          at: '2026-09-21T08:00:00.000Z',
        },
        bestVolume: {
          setId: 'volume',
          volume: 720,
          at: '2026-09-22T08:00:00.000Z',
        },
      },
    })
  })

  it('keeps a record for each exercise apart', () => {
    const sets = [
      set({ id: 'b', exercise_id: BENCH, weight_kg: 60 }),
      set({ id: 's', exercise_id: SQUAT, weight_kg: 100 }),
    ]

    const records = personalRecords(sets)

    expect([records[BENCH]?.bestLoad?.weightKg, records[SQUAT]?.bestLoad?.weightKg]).toEqual([
      60, 100,
    ])
  })

  it('breaks a tie on load with the earlier date', () => {
    const sets = [
      set({ id: 'later', weight_kg: 80, completed_at: '2026-09-23T08:00:00.000Z' }),
      set({ id: 'earlier', weight_kg: 80, completed_at: '2026-09-21T08:00:00.000Z' }),
    ]

    expect(personalRecords(sets)[BENCH]?.bestLoad?.setId).toBe('earlier')
  })

  it('breaks a tie on volume with the earlier date', () => {
    const sets = [
      set({ id: 'later', reps: 10, weight_kg: 50, completed_at: '2026-09-23T08:00:00.000Z' }),
      set({ id: 'earlier', reps: 5, weight_kg: 100, completed_at: '2026-09-21T08:00:00.000Z' }),
    ]

    expect(personalRecords(sets)[BENCH]?.bestVolume?.setId).toBe('earlier')
  })

  it('keeps an earlier bigger volume over a later smaller one', () => {
    const sets = [
      set({ id: 'big', reps: 12, weight_kg: 60, completed_at: '2026-09-21T08:00:00.000Z' }),
      set({ id: 'small', reps: 3, weight_kg: 80, completed_at: '2026-09-22T08:00:00.000Z' }),
    ]

    expect(personalRecords(sets)[BENCH]?.bestVolume?.setId).toBe('big')
  })

  it('compares dates as instants, not as text, across time zone offsets', () => {
    const sets = [
      set({ id: 'later', weight_kg: 80, completed_at: '2026-09-21T09:00:00+02:00' }),
      set({ id: 'earlier', weight_kg: 80, completed_at: '2026-09-21T08:00:00+02:00' }),
    ]

    expect(personalRecords(sets)[BENCH]?.bestLoad?.setId).toBe('earlier')
  })

  it('dates a set with no completion time by when it was created', () => {
    const sets = [set({ id: 'open', completed_at: null, created_at: '2026-09-24T07:30:00.000Z' })]

    expect(personalRecords(sets)[BENCH]?.bestLoad?.at).toBe('2026-09-24T07:30:00.000Z')
  })

  it('skips a soft-deleted set', () => {
    const sets = [
      set({ id: 'kept', weight_kg: 60 }),
      set({ id: 'gone', weight_kg: 120, deleted_at: DELETED }),
    ]

    expect(personalRecords(sets)[BENCH]?.bestLoad?.setId).toBe('kept')
  })

  it('leaves out an exercise whose only set is soft-deleted', () => {
    expect(personalRecords([set({ id: 'gone', deleted_at: DELETED })])).toEqual({})
  })

  it('gives a body weight exercise no load and no volume record', () => {
    expect(personalRecords([set({ id: 'pullup', weight_kg: null })])).toEqual({
      [BENCH]: { bestLoad: null, bestVolume: null },
    })
  })

  it('ignores a body weight set beside a loaded set', () => {
    const sets = [set({ id: 'bw', weight_kg: null }), set({ id: 'loaded', weight_kg: 20 })]

    expect(personalRecords(sets)[BENCH]?.bestLoad?.setId).toBe('loaded')
  })
})

describe('isNewRecord', () => {
  const history = [
    set({ id: 'old1', weight_kg: 80, completed_at: '2026-09-20T08:00:00.000Z' }),
    set({ id: 'old2', weight_kg: 70, completed_at: '2026-09-21T08:00:00.000Z' }),
  ]

  function later(fields: Partial<LiftSet> & { id: string }): LiftSet {
    return set({ completed_at: '2026-09-22T08:00:00.000Z', ...fields })
  }

  it('is true for a heavier load', () => {
    expect(isNewRecord(later({ id: 'new', weight_kg: 82.5 }), history)).toBe(true)
  })

  it('is false for an equal load', () => {
    expect(isNewRecord(later({ id: 'new', weight_kg: 80 }), history)).toBe(false)
  })

  it('is false for a lighter load', () => {
    expect(isNewRecord(later({ id: 'new', weight_kg: 75 }), history)).toBe(false)
  })

  it('is false for the first set of an exercise ever', () => {
    expect(isNewRecord(later({ id: 'first', weight_kg: 20 }), [])).toBe(false)
  })

  it('is false for the first body weight set of an exercise ever', () => {
    expect(isNewRecord(later({ id: 'first', weight_kg: null }), [])).toBe(false)
  })

  it('ignores the set itself when it is already in the history', () => {
    const current = later({ id: 'new', weight_kg: 90 })

    expect(isNewRecord(current, [...history, current])).toBe(true)
  })

  it('is false when the history holds only the set itself', () => {
    const current = later({ id: 'first', weight_kg: 20 })

    expect(isNewRecord(current, [current])).toBe(false)
  })

  it('ignores a history set of another exercise', () => {
    const other = set({ id: 'squat', exercise_id: SQUAT, weight_kg: 140 })

    expect(isNewRecord(later({ id: 'new', weight_kg: 85 }), [...history, other])).toBe(true)
  })

  it('is false when only another exercise has history', () => {
    const other = set({ id: 'squat', exercise_id: SQUAT, weight_kg: 140 })

    expect(isNewRecord(later({ id: 'new', weight_kg: 60 }), [other])).toBe(false)
  })

  it('ignores a soft-deleted history set', () => {
    const gone = set({ id: 'gone', weight_kg: 120, deleted_at: DELETED })

    expect(isNewRecord(later({ id: 'new', weight_kg: 85 }), [...history, gone])).toBe(true)
  })

  it('is false when the only earlier set is soft-deleted', () => {
    const gone = set({ id: 'gone', weight_kg: 20, deleted_at: DELETED })

    expect(isNewRecord(later({ id: 'new', weight_kg: 85 }), [gone])).toBe(false)
  })

  it('is false for a soft-deleted set', () => {
    expect(isNewRecord(later({ id: 'new', weight_kg: 200, deleted_at: DELETED }), history)).toBe(
      false,
    )
  })

  it('is false for a body weight set once the exercise has history', () => {
    expect(isNewRecord(later({ id: 'new', weight_kg: null }), history)).toBe(false)
  })

  it('is false for a loaded set when the history holds only body weight sets', () => {
    const bodyWeight = [set({ id: 'bw', weight_kg: null })]

    expect(isNewRecord(later({ id: 'new', weight_kg: 5 }), bodyWeight)).toBe(false)
  })
  it('compares with the sets done before it only, so a later heavier set hides no record', () => {
    const heavierLater = set({
      id: 'later',
      weight_kg: 100,
      completed_at: '2026-09-23T08:00:00.000Z',
    })

    expect(isNewRecord(later({ id: 'new', weight_kg: 85 }), [...history, heavierLater])).toBe(true)
  })

  it('is false for the first set ever when only later sets are in the history', () => {
    const laterSet = set({ id: 'later', weight_kg: 10, completed_at: '2026-09-23T08:00:00.000Z' })
    const first = set({ id: 'first', weight_kg: 50, completed_at: '2026-09-19T08:00:00.000Z' })

    expect(isNewRecord(first, [laterSet])).toBe(false)
  })

  it('dates a set with no completion time by when it was created', () => {
    const current = set({ id: 'new', weight_kg: 85, created_at: '2026-09-22T08:00:00.000Z' })

    expect(isNewRecord(current, history)).toBe(true)
  })
})

describe('earlierThan', () => {
  it('orders by the completion time first', () => {
    const first = set({
      id: 'b',
      completed_at: '2026-09-20T08:00:00.000Z',
      created_at: '2026-09-21T08:00:00.000Z',
    })
    const second = set({
      id: 'a',
      completed_at: '2026-09-20T09:00:00.000Z',
      created_at: '2026-09-20T07:00:00.000Z',
    })

    expect(earlierThan(first, second)).toBe(true)
    expect(earlierThan(second, first)).toBe(false)
  })

  it('reads created_at when a set has no completion time', () => {
    const first = set({ id: 'b', created_at: '2026-09-20T07:00:00.000Z' })
    const second = set({ id: 'a', completed_at: '2026-09-20T08:00:00.000Z' })

    expect(earlierThan(first, second)).toBe(true)
  })

  it('compares instants, not text, across time zone offsets', () => {
    const first = set({ id: 'b', completed_at: '2026-09-20T09:30:00.000+02:00' })
    const second = set({ id: 'a', completed_at: '2026-09-20T08:00:00.000Z' })

    expect(earlierThan(first, second)).toBe(true)
  })

  it('breaks an equal time by created_at', () => {
    const first = set({
      id: 'b',
      completed_at: '2026-09-20T08:00:00.000Z',
      created_at: '2026-09-20T07:00:00.000Z',
    })
    const second = set({
      id: 'a',
      completed_at: '2026-09-20T08:00:00.000Z',
      created_at: '2026-09-20T07:30:00.000Z',
    })

    expect(earlierThan(first, second)).toBe(true)
  })

  it('breaks a full tie by set_index, then by id', () => {
    const low = { ...set({ id: 'b' }), set_index: 0 }
    const high = { ...set({ id: 'a' }), set_index: 1 }

    expect(earlierThan(low, high)).toBe(true)
    expect(earlierThan(set({ id: 'a' }), set({ id: 'b' }))).toBe(true)
    expect(earlierThan(set({ id: 'a' }), set({ id: 'a' }))).toBe(false)
  })

  it('treats a missing set_index as 0', () => {
    expect(earlierThan(set({ id: 'b' }), { ...set({ id: 'a' }), set_index: 1 })).toBe(true)
  })
})
