import { describe, expect, it } from 'vitest'

import { BENCH, LEG, liftSet, sessionOn } from '../../tests/fixtures/lifts'
import { startedText } from '../workout/SessionTimer'

import { byExercise, rowLine, rowTitle, sessionPath, setText } from './historyText'

import type { SessionStats } from '../../lib/metrics/sessionStats'

const STATS: SessionStats = {
  durationSeconds: 4325,
  setCount: 18,
  exerciseCount: 4,
  volumeKg: 3420,
  newRecords: [],
}

const SESSION = sessionOn('2026-09-01')

describe('sessionPath', () => {
  it('puts the id in the session query', () => {
    expect(sessionPath('abc')).toBe('/workouts?session=abc')
  })
})

describe('rowTitle', () => {
  it('writes the date and the start time', () => {
    expect(rowTitle(SESSION)).toBe(`Tue 1 Sep · ${startedText(SESSION.started_at)}`)
  })
})

describe('rowLine', () => {
  it('writes the duration, the sets and the volume in kilograms', () => {
    expect(rowLine(STATS, 'metric')).toBe('1h 12m · 18 sets · 3,420 kg')
  })

  it('writes 1 set and the volume in pounds', () => {
    expect(rowLine({ ...STATS, setCount: 1 }, 'imperial')).toBe('1h 12m · 1 set · 7,540 lb')
  })
})

describe('setText', () => {
  it('writes the reps and the load', () => {
    expect(setText(liftSet(SESSION, BENCH, 10, 60), 'metric')).toBe('10 × 60 kg')
  })

  it('writes the reps alone for a body-weight set', () => {
    expect(setText(liftSet(SESSION, BENCH, 15, null), 'metric')).toBe('15 reps')
  })
})

describe('byExercise', () => {
  it('keeps the first-seen exercise order and the set order inside each', () => {
    const a = liftSet(SESSION, BENCH, 10, 60)
    const b = liftSet(SESSION, LEG, 12, 100)
    const c = liftSet(SESSION, BENCH, 8, 65)

    expect(byExercise([a, b, c])).toEqual([
      { exerciseId: BENCH, sets: [a, c] },
      { exerciseId: LEG, sets: [b] },
    ])
  })
})
