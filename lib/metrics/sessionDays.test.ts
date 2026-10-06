import { describe, expect, it } from 'vitest'

import { sessionDays, sessionsByDate } from './sessionDays'

import type { SessionRow } from './sessionDays'

function session(date: string, overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    entry_date: date,
    started_at: `${date}T07:00:00.000Z`,
    ended_at: `${date}T08:00:00.000Z`,
    deleted_at: null,
    ...overrides,
  }
}

function day(date: string, gymSeconds: number | null) {
  return { entry_date: date, gym_seconds: gymSeconds }
}

describe('sessionDays', () => {
  it('returns a date with a finished session and no entry', () => {
    expect(sessionDays([], [session('2026-09-02')])).toEqual(['2026-09-02'])
  })

  it('returns a date with typed gym time and no session', () => {
    expect(sessionDays([day('2026-09-02', 3600)], [])).toEqual(['2026-09-02'])
  })

  it('leaves out a day with an entry but no gym time and no session', () => {
    expect(sessionDays([day('2026-09-02', null)], [])).toEqual([])
  })

  it('leaves out a typed 0 day, even with a finished session', () => {
    expect(sessionDays([day('2026-09-02', 0)], [session('2026-09-02')])).toEqual([])
  })

  it('leaves out a day with only a live session', () => {
    expect(sessionDays([], [session('2026-09-02', { ended_at: null })])).toEqual([])
  })

  it('returns each date once and in order', () => {
    const sessions = [
      session('2026-09-05'),
      session('2026-09-02'),
      session('2026-09-02', {
        started_at: '2026-09-02T18:00:00.000Z',
        ended_at: '2026-09-02T19:00:00.000Z',
      }),
    ]

    expect(sessionDays([], sessions)).toEqual(['2026-09-02', '2026-09-05'])
  })
})

describe('sessionsByDate', () => {
  it('groups the sessions under their entry date', () => {
    const morning = session('2026-09-02')
    const evening = session('2026-09-02', { started_at: '2026-09-02T18:00:00.000Z' })
    const next = session('2026-09-03')

    expect(sessionsByDate([morning, evening, next])).toEqual(
      new Map([
        ['2026-09-02', [morning, evening]],
        ['2026-09-03', [next]],
      ]),
    )
  })
})
