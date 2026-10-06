import { describe, expect, it } from 'vitest'

import { effectiveGymSeconds, hasSession } from './gymTime'

import type { WorkoutSession } from '../db/dexie'

const DATE = '2026-09-19'

type SessionTimes = Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>

function session(overrides: Partial<SessionTimes> = {}): SessionTimes {
  return {
    entry_date: DATE,
    started_at: '2026-09-19T07:00:00.000Z',
    ended_at: '2026-09-19T08:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

const EVENING = session({
  started_at: '2026-09-19T18:00:00.000Z',
  ended_at: '2026-09-19T18:30:00.000Z',
})

const LIVE = session({ started_at: '2026-09-19T19:00:00.000Z', ended_at: null })

describe('effectiveGymSeconds', () => {
  it('lets a typed gym time win over the sessions', () => {
    expect(effectiveGymSeconds({ gym_seconds: 2700 }, [session()])).toEqual({
      seconds: 2700,
      source: 'typed',
    })
  })

  it('reads a typed 0 as no gym, even with a finished session', () => {
    expect(effectiveGymSeconds({ gym_seconds: 0 }, [session()])).toEqual({
      seconds: 0,
      source: 'typed',
    })
  })

  it('adds 2 finished sessions on a day with no typed value', () => {
    expect(effectiveGymSeconds({ gym_seconds: null }, [session(), EVENING])).toEqual({
      seconds: 5400,
      source: 'sessions',
    })
  })

  it('adds 0 for a live session with no end, and calls the day none', () => {
    expect(effectiveGymSeconds(undefined, [LIVE])).toEqual({ seconds: 0, source: 'none' })
  })

  it('ignores a soft-deleted session', () => {
    const deleted = session({ deleted_at: '2026-09-19T09:00:00.000Z' })

    expect(effectiveGymSeconds(undefined, [deleted, EVENING])).toEqual({
      seconds: 1800,
      source: 'sessions',
    })
  })

  it('adds 0 for a session that ends before it starts', () => {
    const backwards = session({ ended_at: '2026-09-19T06:00:00.000Z' })

    expect(effectiveGymSeconds(undefined, [backwards, EVENING])).toEqual({
      seconds: 1800,
      source: 'sessions',
    })
  })

  it('returns 0 and none for no entry and no sessions', () => {
    expect(effectiveGymSeconds(undefined, [])).toEqual({ seconds: 0, source: 'none' })
  })

  it('returns 0 and none for an entry with no gym time and no sessions', () => {
    expect(effectiveGymSeconds({ gym_seconds: null }, [])).toEqual({ seconds: 0, source: 'none' })
  })
})

describe('hasSession', () => {
  it('is true for a finished session on a day with no typed value', () => {
    expect(hasSession(undefined, [session()])).toBe(true)
  })

  it('is false for a typed 0, even with a finished session', () => {
    expect(hasSession({ gym_seconds: 0 }, [session()])).toBe(false)
  })

  it('is false for a day with only a live session', () => {
    expect(hasSession({ gym_seconds: null }, [LIVE])).toBe(false)
  })
})
