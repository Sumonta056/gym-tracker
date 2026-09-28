import { describe, expect, it } from 'vitest'

import { setVolume, volumeByExercise, volumeBySession, volumeLoad } from './volumeLoad'

import type { LiftSet } from './volumeLoad'

const SESSION_A = '00000000-0000-4000-8000-00000000000a'
const SESSION_B = '00000000-0000-4000-8000-00000000000b'
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

describe('setVolume', () => {
  it('multiplies the reps by the load', () => {
    expect(setVolume(set({ id: 's1', reps: 8, weight_kg: 62.5 }))).toBe(500)
  })

  it('counts a body weight set with a null load as 0', () => {
    expect(setVolume(set({ id: 's1', weight_kg: null }))).toBe(0)
  })

  it('returns 0 for a soft-deleted set', () => {
    expect(setVolume(set({ id: 's1', deleted_at: '2026-09-20T09:00:00.000Z' }))).toBe(0)
  })

  it('returns 0 for zero reps', () => {
    expect(setVolume(set({ id: 's1', reps: 0 }))).toBe(0)
  })
})

describe('volumeLoad', () => {
  it('returns 0 for an empty session', () => {
    expect(volumeLoad([])).toBe(0)
  })

  it('adds reps times weight across the sets', () => {
    const sets = [
      set({ id: 's1', reps: 10, weight_kg: 40 }),
      set({ id: 's2', reps: 8, weight_kg: 50 }),
    ]

    expect(volumeLoad(sets)).toBe(800)
  })

  it('counts a body weight set with a null load as 0, not a crash', () => {
    const sets = [set({ id: 's1', weight_kg: null }), set({ id: 's2', reps: 5, weight_kg: 20 })]

    expect(volumeLoad(sets)).toBe(100)
  })

  it('skips a soft-deleted set', () => {
    const sets = [
      set({ id: 's1', reps: 10, weight_kg: 40 }),
      set({ id: 's2', reps: 10, weight_kg: 100, deleted_at: '2026-09-20T09:00:00.000Z' }),
    ]

    expect(volumeLoad(sets)).toBe(400)
  })

  it('rounds the total to two decimals', () => {
    const sets = [
      set({ id: 's1', reps: 1, weight_kg: 0.1 }),
      set({ id: 's2', reps: 1, weight_kg: 0.2 }),
    ]

    expect(volumeLoad(sets)).toBe(0.3)
  })
})

describe('volumeBySession', () => {
  it('returns an empty result for no sets', () => {
    expect(volumeBySession([])).toEqual({})
  })

  it('sums the volume for each session', () => {
    const sets = [
      set({ id: 's1', session_id: SESSION_A, reps: 10, weight_kg: 40 }),
      set({ id: 's2', session_id: SESSION_A, reps: 5, weight_kg: 60 }),
      set({ id: 's3', session_id: SESSION_B, reps: 3, weight_kg: 100 }),
    ]

    expect(volumeBySession(sets)).toEqual({ [SESSION_A]: 700, [SESSION_B]: 300 })
  })

  it('leaves out a session whose only set is soft-deleted', () => {
    const sets = [
      set({ id: 's1', session_id: SESSION_A }),
      set({ id: 's2', session_id: SESSION_B, deleted_at: '2026-09-20T09:00:00.000Z' }),
    ]

    expect(volumeBySession(sets)).toEqual({ [SESSION_A]: 400 })
  })

  it('keeps a session of body weight sets at 0', () => {
    expect(volumeBySession([set({ id: 's1', weight_kg: null })])).toEqual({ [SESSION_A]: 0 })
  })
})

describe('volumeByExercise', () => {
  it('sums the volume for each exercise', () => {
    const sets = [
      set({ id: 's1', exercise_id: BENCH, reps: 10, weight_kg: 40 }),
      set({ id: 's2', exercise_id: SQUAT, reps: 5, weight_kg: 80 }),
      set({ id: 's3', exercise_id: BENCH, session_id: SESSION_B, reps: 10, weight_kg: 42.5 }),
    ]

    expect(volumeByExercise(sets)).toEqual({ [BENCH]: 825, [SQUAT]: 400 })
  })
})
