import { describe, expect, it } from 'vitest'

import { sessionLengthSeconds } from './gymTime'

import type { WorkoutSession } from '../db/dexie'

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
