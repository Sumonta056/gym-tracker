import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REST_SECONDS,
  EXTRA_REST_SECONDS,
  remainingSeconds,
  restEndsAt,
  restProgress,
  restSecondsFor,
  restTotalSeconds,
} from './restTimer'

const BENCH_ID = '33333333-3333-4333-8333-333333333333'
const SQUAT_ID = '44444444-4444-4444-8444-444444444444'
const COMPLETED_AT = '2026-09-30T17:30:00.000Z'

function at(secondsAfter: number): Date {
  return new Date(Date.parse(COMPLETED_AT) + secondsAfter * 1000)
}

describe('restSecondsFor', () => {
  it('returns the saved rest for the exercise', () => {
    expect(restSecondsFor({ [BENCH_ID]: 120 }, BENCH_ID)).toBe(120)
  })

  it('returns 90 seconds for an exercise with no saved rest', () => {
    expect(restSecondsFor({ [BENCH_ID]: 120 }, SQUAT_ID)).toBe(DEFAULT_REST_SECONDS)
    expect(DEFAULT_REST_SECONDS).toBe(90)
  })

  it('keeps a saved rest of 0 seconds', () => {
    expect(restSecondsFor({ [BENCH_ID]: 0 }, BENCH_ID)).toBe(0)
  })
})

describe('restTotalSeconds', () => {
  it('adds 30 seconds for each +30 s tap', () => {
    expect(EXTRA_REST_SECONDS).toBe(30)
    expect(restTotalSeconds(90, 0)).toBe(90)
    expect(restTotalSeconds(90, 2)).toBe(150)
  })
})

describe('restEndsAt', () => {
  it('ends at the completed time plus the rest seconds', () => {
    expect(restEndsAt(COMPLETED_AT, 90, 0)).toBe(at(90).getTime())
  })

  it('moves the end 30 seconds later for each +30 s tap', () => {
    expect(restEndsAt(COMPLETED_AT, 90, 1)).toBe(at(120).getTime())
  })
})

describe('remainingSeconds', () => {
  const endsAt = restEndsAt(COMPLETED_AT, 90, 0)

  it('shows the full rest at the moment the set is saved', () => {
    expect(remainingSeconds(endsAt, at(0))).toBe(90)
  })

  it('is correct after a simulated 60 second gap', () => {
    expect(remainingSeconds(endsAt, at(60))).toBe(30)
  })

  it('rounds a part second up so the clock reaches 0 only at the end', () => {
    expect(remainingSeconds(endsAt, new Date(at(89).getTime() + 400))).toBe(1)
  })

  it('reaches 0 at the end time', () => {
    expect(remainingSeconds(endsAt, at(90))).toBe(0)
  })

  it('never goes below 0 after the end', () => {
    expect(remainingSeconds(endsAt, at(600))).toBe(0)
  })

  it('counts a +30 s tap made after the gap', () => {
    expect(remainingSeconds(restEndsAt(COMPLETED_AT, 90, 1), at(60))).toBe(60)
  })
})

describe('restProgress', () => {
  it('returns the share of the rest still to run, as a percentage', () => {
    expect(restProgress(84, 90)).toBeCloseTo(93.33, 2)
  })

  it('returns 0 for a rest of no length', () => {
    expect(restProgress(0, 0)).toBe(0)
  })

  it('never goes above 100', () => {
    expect(restProgress(120, 90)).toBe(100)
  })
})
