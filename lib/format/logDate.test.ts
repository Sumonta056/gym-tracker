import { describe, expect, it } from 'vitest'

import { dayPath, localNoon, logPath, parseLogDate, shiftLogDate } from './logDate'

const TODAY = '2026-10-05'

describe('parseLogDate', () => {
  it.each([null, '', 'soon', '2026-9-1', '2026-13-01', '2026-02-30'])(
    'returns today for %s',
    (value) => {
      expect(parseLogDate(value, TODAY)).toBe(TODAY)
    },
  )

  it('returns today for a date after today', () => {
    expect(parseLogDate('2026-10-06', TODAY)).toBe(TODAY)
  })

  it('returns a valid past date and today as they are', () => {
    expect(parseLogDate('2026-09-19', TODAY)).toBe('2026-09-19')
    expect(parseLogDate(TODAY, TODAY)).toBe(TODAY)
  })
})

describe('shiftLogDate', () => {
  it('crosses a month end and a year end', () => {
    expect(shiftLogDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftLogDate('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('logPath', () => {
  it('builds the log address for a day', () => {
    expect(logPath('2026-09-19')).toBe('/log?date=2026-09-19')
  })
})

describe('dayPath', () => {
  it('returns the root for today', () => {
    expect(dayPath(TODAY, TODAY)).toBe('/')
  })

  it('carries the date for any other day', () => {
    expect(dayPath('2026-09-19', TODAY)).toBe('/?date=2026-09-19')
  })
})

describe('localNoon', () => {
  it('builds a local time in the middle of the day', () => {
    const at = localNoon('2026-09-19')
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours()]).toEqual([
      2026, 8, 19, 12,
    ])
  })

  it('falls back to the epoch day for an invalid date', () => {
    const at = localNoon('soon')
    expect([at.getFullYear(), at.getMonth(), at.getDate()]).toEqual([1970, 0, 1])
  })
})
