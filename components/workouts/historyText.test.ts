import { describe, expect, it } from 'vitest'

import { BENCH, LEG, liftSet, sessionOn } from '../../tests/fixtures/lifts'
import { startedText } from '../workout/SessionTimer'

import {
  byExercise,
  byMonthAndDay,
  dayNumber,
  dayTitle,
  DELETE_HINT,
  deleteBody,
  deleteLabel,
  EMPTY_ROW,
  groupName,
  groupsOf,
  monthLabel,
  recordsText,
  rowDetail,
  rowLine,
  rowTitle,
  sessionPath,
  sessionsText,
  setText,
  weekday,
} from './historyText'

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

describe('monthLabel', () => {
  it('writes the full month and the year', () => {
    expect(monthLabel('2026-10-16')).toBe('October 2026')
  })
})

describe('dayNumber', () => {
  it('writes the day of the month with no leading zero', () => {
    expect(dayNumber('2026-10-05')).toBe('5')
  })
})

describe('weekday', () => {
  it('writes the short weekday', () => {
    expect(weekday('2026-10-16')).toBe('Fri')
  })
})

describe('dayTitle', () => {
  it('writes the weekday, the day and the month', () => {
    expect(dayTitle('2026-10-16')).toBe('Fri 16 Oct')
  })
})

describe('sessionsText', () => {
  it('writes 1 session', () => {
    expect(sessionsText(1)).toBe('1 session')
  })

  it('writes the plural past 1', () => {
    expect(sessionsText(4)).toBe('4 sessions')
  })
})

describe('recordsText', () => {
  it('writes the count of records', () => {
    expect([recordsText(1), recordsText(2)]).toEqual(['1 PR', '2 PRs'])
  })
})

describe('groupName', () => {
  it('capitalises a muscle group', () => {
    expect(groupName('shoulders')).toBe('Shoulders')
  })
})

describe('rowDetail', () => {
  it('writes the duration, the sets and the groups', () => {
    expect(rowDetail({ ...STATS, durationSeconds: 3120, setCount: 14 }, ['chest', 'arms'])).toBe(
      '52m · 14 sets · Chest, Arms',
    )
  })

  it('leaves out the groups when none is known', () => {
    expect(rowDetail({ ...STATS, setCount: 1 }, [])).toBe('1h 12m · 1 set')
  })

  it('says an empty session has no set', () => {
    expect(rowDetail({ ...STATS, setCount: 0 }, ['chest'])).toBe(EMPTY_ROW)
  })
})

describe('EMPTY_ROW', () => {
  it('names an empty session', () => {
    expect(EMPTY_ROW).toBe('Empty session · no sets logged')
  })
})

describe('DELETE_HINT', () => {
  it('says the delete reaches every device', () => {
    expect(DELETE_HINT).toBe('It goes from all your devices after the next sync.')
  })
})

describe('deleteLabel', () => {
  it('names the date and the start time of the session', () => {
    expect(deleteLabel(SESSION)).toBe(
      `Delete the session of Tue 1 Sep at ${startedText(SESSION.started_at)}`,
    )
  })
})

describe('deleteBody', () => {
  it('counts the sets that go', () => {
    expect(deleteBody(1)).toBe(
      'The session and its 1 set go from this device and from every other device after the next sync.',
    )
  })

  it('names the session alone when it has no set', () => {
    expect(deleteBody(0)).toBe(
      'The session goes from this device and from every other device after the next sync.',
    )
  })
})

describe('groupsOf', () => {
  it('keeps each known group once, in the order of the first set', () => {
    const groupOf = new Map([
      [BENCH, 'chest' as const],
      [LEG, 'legs' as const],
    ])
    const sets = [
      liftSet(SESSION, LEG, 10, 100),
      liftSet(SESSION, 'unknown', 5, 10),
      liftSet(SESSION, BENCH, 8, 60),
      liftSet(SESSION, LEG, 10, 100),
    ]

    expect(groupsOf(sets, groupOf)).toEqual(['legs', 'chest'])
  })
})

describe('byMonthAndDay', () => {
  it('groups newest-first rows by month, then by date', () => {
    const a = { session: sessionOn('2026-10-16') }
    const b = { session: sessionOn('2026-10-16', { id: 'b' }) }
    const c = { session: sessionOn('2026-10-02') }
    const d = { session: sessionOn('2026-09-29') }

    expect(byMonthAndDay([a, b, c, d])).toEqual([
      {
        label: 'October 2026',
        count: 3,
        days: [
          { date: '2026-10-16', rows: [a, b] },
          { date: '2026-10-02', rows: [c] },
        ],
      },
      { label: 'September 2026', count: 1, days: [{ date: '2026-09-29', rows: [d] }] },
    ])
  })

  it('returns no month for no row', () => {
    expect(byMonthAndDay([])).toEqual([])
  })
})
