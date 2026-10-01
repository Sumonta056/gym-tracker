import { describe, expect, it } from 'vitest'

import {
  bestOneRepMax,
  oneRepMaxBySession,
  sessionVolumes,
  volumeBetween,
  weekChange,
  weekToDateChange,
} from './liftTrends'

import type { LiftSet } from './volumeLoad'

const SESSION_A = '00000000-0000-4000-8000-00000000000a'
const SESSION_B = '00000000-0000-4000-8000-00000000000b'
const SESSION_C = '00000000-0000-4000-8000-00000000000c'
const BENCH = '00000000-0000-4000-8000-0000000000b1'
const SQUAT = '00000000-0000-4000-8000-0000000000c1'

function set(fields: Partial<LiftSet> & { id: string }): LiftSet {
  return {
    session_id: SESSION_A,
    exercise_id: BENCH,
    reps: 10,
    weight_kg: 40,
    completed_at: null,
    created_at: '2026-09-20T08:00:00.000Z',
    deleted_at: null,
    ...fields,
  }
}

const SESSIONS = [
  { id: SESSION_A, entry_date: '2026-09-02' },
  { id: SESSION_B, entry_date: '2026-09-09' },
  { id: SESSION_C, entry_date: '2026-09-10' },
]

describe('sessionVolumes', () => {
  it('gives every session its volume load, in the order of the sessions', () => {
    const sets = [
      set({ id: 's1', session_id: SESSION_B, reps: 8, weight_kg: 62.5 }),
      set({ id: 's2', session_id: SESSION_A, reps: 10, weight_kg: 40 }),
      set({ id: 's3', session_id: SESSION_A, reps: 5, weight_kg: 100 }),
    ]

    expect(sessionVolumes(SESSIONS, sets)).toEqual([
      { sessionId: SESSION_A, date: '2026-09-02', volume: 900 },
      { sessionId: SESSION_B, date: '2026-09-09', volume: 500 },
      { sessionId: SESSION_C, date: '2026-09-10', volume: 0 },
    ])
  })

  it('leaves a soft-deleted set out of the volume', () => {
    const sets = [
      set({ id: 's1', reps: 10, weight_kg: 40 }),
      set({ id: 's2', reps: 10, weight_kg: 40, deleted_at: '2026-09-20T09:00:00.000Z' }),
    ]

    expect(sessionVolumes(SESSIONS.slice(0, 1), sets)).toEqual([
      { sessionId: SESSION_A, date: '2026-09-02', volume: 400 },
    ])
  })

  it('returns an empty list for no session', () => {
    expect(sessionVolumes([], [set({ id: 's1' })])).toEqual([])
  })
})

describe('volumeBetween', () => {
  const volumes = [
    { sessionId: SESSION_A, date: '2026-09-02', volume: 900.25 },
    { sessionId: SESSION_B, date: '2026-09-09', volume: 500.5 },
    { sessionId: SESSION_C, date: '2026-09-10', volume: 100 },
  ]

  it('adds the volume of the sessions dated from the first date to the last, both included', () => {
    expect(volumeBetween(volumes, '2026-09-09', '2026-09-10')).toBe(600.5)
  })

  it('returns 0 when no session falls between the dates', () => {
    expect(volumeBetween(volumes, '2026-09-03', '2026-09-08')).toBe(0)
  })
})

describe('weekChange', () => {
  it('returns the rise against last week as a whole percent', () => {
    expect(weekChange(5900, 5000)).toBe(18)
  })

  it('returns a fall as a negative whole percent', () => {
    expect(weekChange(4000, 5000)).toBe(-20)
  })

  it('returns 0 for the same volume', () => {
    expect(weekChange(5000, 5000)).toBe(0)
  })

  it('returns null when last week has no volume to compare against', () => {
    expect(weekChange(5000, 0)).toBeNull()
  })

  it('returns -100 for a week with no volume after a week with some', () => {
    expect(weekChange(0, 5000)).toBe(-100)
  })
})

describe('oneRepMaxBySession', () => {
  it('takes the best Epley estimate of the exercise in each session', () => {
    const sets = [
      set({ id: 's1', session_id: SESSION_A, reps: 8, weight_kg: 45 }),
      set({ id: 's2', session_id: SESSION_A, reps: 1, weight_kg: 50 }),
      set({ id: 's3', session_id: SESSION_B, reps: 12, weight_kg: 35 }),
      set({ id: 's4', session_id: SESSION_B, exercise_id: SQUAT, reps: 5, weight_kg: 200 }),
    ]

    expect(oneRepMaxBySession(sets, BENCH)).toEqual({ [SESSION_A]: 57, [SESSION_B]: 49 })
  })

  it('skips a soft-deleted set, a set with no load and a set with a load of 0', () => {
    const sets = [
      set({ id: 's1', reps: 1, weight_kg: 90, deleted_at: '2026-09-20T09:00:00.000Z' }),
      set({ id: 's2', session_id: SESSION_B, weight_kg: null }),
      set({ id: 's3', session_id: SESSION_C, weight_kg: 0 }),
      set({ id: 's4', reps: 1, weight_kg: 60 }),
    ]

    expect(oneRepMaxBySession(sets, BENCH)).toEqual({ [SESSION_A]: 60 })
  })

  it('returns an empty record for an exercise with no set', () => {
    expect(oneRepMaxBySession([set({ id: 's1' })], SQUAT)).toEqual({})
  })
})

describe('bestOneRepMax', () => {
  it('takes the best Epley estimate of each exercise across every session', () => {
    const sets = [
      set({ id: 's1', session_id: SESSION_A, reps: 8, weight_kg: 45 }),
      set({ id: 's2', session_id: SESSION_B, reps: 10, weight_kg: 42.5 }),
      set({ id: 's3', exercise_id: SQUAT, reps: 10, weight_kg: 80 }),
    ]

    expect(bestOneRepMax(sets)).toEqual({ [BENCH]: 57, [SQUAT]: 106.67 })
  })

  it('skips a soft-deleted set, a set with no load and a set with a load of 0', () => {
    const sets = [
      set({ id: 's1', reps: 1, weight_kg: 90, deleted_at: '2026-09-20T09:00:00.000Z' }),
      set({ id: 's2', weight_kg: null }),
      set({ id: 's3', exercise_id: SQUAT, weight_kg: 0 }),
    ]

    expect(bestOneRepMax(sets)).toEqual({})
  })
})

describe('weekToDateChange', () => {
  const volumes = [
    { sessionId: 'a', date: '2026-09-14', volume: 1000 },
    { sessionId: 'b', date: '2026-09-15', volume: 1000 },
    { sessionId: 'c', date: '2026-09-17', volume: 3000 },
    { sessionId: 'd', date: '2026-09-20', volume: 1000 },
    { sessionId: 'e', date: '2026-09-21', volume: 1500 },
    { sessionId: 'f', date: '2026-09-22', volume: 1000 },
    { sessionId: 'g', date: '2026-09-27', volume: 500 },
  ]

  it('compares Monday to today with the same weekdays of last week', () => {
    expect(weekToDateChange(volumes, '2026-09-22')).toBe(25)
  })

  it('compares one day with one day on a Monday', () => {
    expect(weekToDateChange(volumes, '2026-09-21')).toBe(50)
  })

  it('compares the full week with the full week before on a Sunday', () => {
    expect(weekToDateChange(volumes, '2026-09-27')).toBe(-50)
  })

  it('leaves out a session of last week after the same weekday', () => {
    expect(weekToDateChange(volumes, '2026-09-23')).toBe(25)
  })

  it('returns null when the same days of last week hold no volume', () => {
    expect(weekToDateChange(volumes, '2026-09-16')).toBeNull()
  })

  it('returns null for a date it cannot read', () => {
    expect(weekToDateChange(volumes, 'not a date')).toBeNull()
  })
})
