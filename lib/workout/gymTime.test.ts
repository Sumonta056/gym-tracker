import { describe, expect, it } from 'vitest'

import { gymTimeOffer, newestFinished, sessionLengthSeconds } from './gymTime'

import type { DailyEntry, WorkoutSession } from '../db/dexie'

const DATE = '2026-09-19'

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    entry_date: DATE,
    started_at: '2026-09-19T17:30:00.000Z',
    ended_at: '2026-09-19T18:42:05.000Z',
    status: 'finished',
    created_at: '2026-09-19T17:30:00.000Z',
    updated_at: '2026-09-19T18:42:05.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function day(gymSeconds: number | null): DailyEntry {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    entry_date: DATE,
    walk_seconds: null,
    gym_seconds: gymSeconds,
    avg_heart_rate: null,
    max_heart_rate: null,
    weight_kg: null,
    calories_burnt: null,
    steps: null,
    note: null,
    created_at: '2026-09-19T10:00:00.000Z',
    updated_at: '2026-09-19T10:00:00.000Z',
    deleted_at: null,
  }
}

describe('sessionLengthSeconds', () => {
  it('returns ended_at minus started_at in whole seconds', () => {
    expect(sessionLengthSeconds(session())).toBe(4325)
  })

  it('drops a part second rather than rounding it up', () => {
    expect(sessionLengthSeconds(session({ ended_at: '2026-09-19T18:42:05.999Z' }))).toBe(4325)
  })

  it('returns null for a session with no end', () => {
    expect(sessionLengthSeconds(session({ ended_at: null, status: 'active' }))).toBeNull()
  })

  it('returns 0 when the end sits before the start', () => {
    expect(sessionLengthSeconds(session({ ended_at: '2026-09-19T17:29:00.000Z' }))).toBe(0)
  })

  it('counts a session from 23:30 to 00:30 as one hour', () => {
    const started = new Date(2026, 8, 19, 23, 30).toISOString()
    const ended = new Date(2026, 8, 20, 0, 30).toISOString()

    expect(sessionLengthSeconds(session({ started_at: started, ended_at: ended }))).toBe(3600)
  })
})

describe('gymTimeOffer', () => {
  it('offers the session length for a day with no row', () => {
    expect(gymTimeOffer(session(), undefined)).toEqual({
      sessionId: session().id,
      entryDate: DATE,
      sessionSeconds: 4325,
      loggedSeconds: null,
    })
  })

  it('offers the session length for a row with no gym time', () => {
    expect(gymTimeOffer(session(), day(null))).toMatchObject({ loggedSeconds: null })
  })

  it('carries both values for a row with a different gym time', () => {
    expect(gymTimeOffer(session(), day(3900))).toMatchObject({
      sessionSeconds: 4325,
      loggedSeconds: 3900,
    })
  })

  it('makes no offer when the row already holds the same value', () => {
    expect(gymTimeOffer(session(), day(4325))).toBeNull()
  })

  it('makes no offer for an active session', () => {
    expect(gymTimeOffer(session({ status: 'active', ended_at: null }), undefined)).toBeNull()
  })

  it('makes no offer for a deleted session', () => {
    expect(gymTimeOffer(session({ deleted_at: '2026-09-19T19:00:00.000Z' }), undefined)).toBeNull()
  })

  it('makes no offer for a session of 0 seconds', () => {
    expect(gymTimeOffer(session({ ended_at: session().started_at }), undefined)).toBeNull()
  })

  it('makes no offer for a session longer than 24 hours', () => {
    expect(gymTimeOffer(session({ ended_at: '2026-09-20T17:30:01.000Z' }), undefined)).toBeNull()
  })

  it('still offers a session of exactly 24 hours', () => {
    expect(
      gymTimeOffer(session({ ended_at: '2026-09-20T17:30:00.000Z' }), undefined),
    ).toMatchObject({ sessionSeconds: 86400 })
  })
})

describe('newestFinished', () => {
  it('picks the finished session with the newest start', () => {
    const early = session({ id: 'a', started_at: '2026-09-19T08:00:00.000Z' })
    const late = session({ id: 'b', started_at: '2026-09-19T17:30:00.000Z' })

    expect(newestFinished([early, late])?.id).toBe('b')
  })

  it('breaks a start tie by id', () => {
    const second = session({ id: 'b' })
    const first = session({ id: 'a' })

    expect(newestFinished([second, first])?.id).toBe('a')
  })

  it('skips an active and a deleted session', () => {
    const active = session({ id: 'a', status: 'active', ended_at: null })
    const gone = session({ id: 'b', deleted_at: '2026-09-19T19:00:00.000Z' })

    expect(newestFinished([active, gone])).toBeUndefined()
  })
})
