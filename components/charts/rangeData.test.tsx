import { describe, expect, it } from 'vitest'

import { movingAverage } from '../../lib/metrics/movingAverage'
import { streak } from '../../lib/metrics/streak'
import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'

import {
  analyse,
  averagePerLoggedDay,
  countList,
  dayTick,
  highestIndex,
  lastIndex,
  loggedDays,
  tickDates,
  datesIn,
  formatKg,
  HEAT_MAP_WEEKS,
  heatMapFor,
  presentValues,
  rangeFor,
  rangeLabel,
  readWindow,
  signedKg,
  sum,
  trendWord,
} from './rangeData'

describe('rangeFor', () => {
  it('covers only today on the day tab', () => {
    expect(rangeFor('day', TODAY)).toEqual({ from: TODAY, to: TODAY })
  })

  it('covers Monday to Sunday on the week tab', () => {
    expect(rangeFor('week', TODAY)).toEqual({ from: '2026-09-21', to: '2026-09-27' })
  })

  it('covers the calendar month on the month tab', () => {
    expect(rangeFor('month', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('ends february on the twenty ninth in a leap year', () => {
    expect(rangeFor('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('readWindow', () => {
  it('reads six days before the range so the first day has a seven day average', () => {
    expect(readWindow({ from: '2026-09-21', to: '2026-09-27' })).toEqual({
      from: '2026-09-15',
      to: '2026-09-27',
    })
  })
})

describe('datesIn', () => {
  it('lists every date from the first to the last', () => {
    expect(datesIn({ from: '2026-09-29', to: '2026-10-02' })).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ])
  })

  it('lists a single date for a one day range', () => {
    expect(datesIn({ from: TODAY, to: TODAY })).toEqual([TODAY])
  })

  it('returns one date when the end is malformed', () => {
    expect(datesIn({ from: TODAY, to: 'soon' })).toEqual([TODAY])
  })

  it('returns no date when the start is malformed', () => {
    expect(datesIn({ from: 'soon', to: TODAY })).toEqual([])
  })
})

describe('rangeLabel', () => {
  it('names a single day by its day and month', () => {
    expect(rangeLabel({ from: TODAY, to: TODAY })).toBe('23 September')
  })

  it('names a week inside one month once', () => {
    expect(rangeLabel({ from: '2026-09-14', to: '2026-09-20' })).toBe('14 – 20 September')
  })

  it('names both months for a week across a month end', () => {
    expect(rangeLabel({ from: '2026-09-28', to: '2026-10-04' })).toBe('28 September – 4 October')
  })
})

describe('heatMapFor', () => {
  const weeks = heatMapFor(new Set(['2026-09-22', TODAY]), TODAY)

  it('holds twelve weeks of seven days', () => {
    expect(weeks).toHaveLength(HEAT_MAP_WEEKS)
    expect(weeks.every((week) => week.days.length === 7)).toBe(true)
  })

  it('ends on the Sunday of this week', () => {
    expect(weeks.at(-1)?.days.at(-1)?.date).toBe('2026-09-27')
  })

  it('starts each week on a Monday', () => {
    expect(weeks[0]?.start).toBe('2026-07-06')
  })

  it('marks a logged day, a missed day and a future day', () => {
    const last = weeks.at(-1)?.days.map((cell) => cell.state)
    expect(last).toEqual(['missed', 'logged', 'logged', 'future', 'future', 'future', 'future'])
  })
})

describe('analyse', () => {
  const entries = [
    entryOn('2026-09-16', { weight_kg: 75 }),
    entryOn('2026-09-21', { weight_kg: 74 }),
    entryOn(TODAY, { weight_kg: 73, steps: 9000, calories_burnt: 700 }),
  ]
  const history = [entryOn('2026-09-20'), ...entries, entryOn('2026-09-30')]
  const data = analyse(entries, history, 'week', TODAY, NOW, 12000)

  it('holds one point per day of the range', () => {
    expect(data.days.map((day) => day.date)).toEqual(datesIn(rangeFor('week', TODAY)))
  })

  it('names the range', () => {
    expect(data.label).toBe('21 – 27 September')
  })

  it('leaves a day with no entry as nulls', () => {
    expect(data.days[1]).toEqual({
      date: '2026-09-22',
      logged: false,
      weightKg: null,
      averageKg: null,
      calories: null,
      steps: null,
      avgHeartRate: null,
      maxHeartRate: null,
      gymSeconds: null,
    })
  })

  it('takes the seven day average from lib/metrics/movingAverage, reading the days before the range', () => {
    const expected = movingAverage(
      entries.map((row) => ({ date: row.entry_date, value: row.weight_kg })),
    ).find((point) => point.date === TODAY)?.average
    expect(data.days[2]?.averageKg).toBe(expected)
    expect(data.days[2]?.averageKg).toBe(73.5)
  })

  it('marks a day with an entry as logged', () => {
    expect(data.days.map((day) => day.logged)).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  it('carries the daily step goal it is given', () => {
    expect(data.stepGoal).toBe(12000)
  })

  it('totals only the days inside the range', () => {
    expect(data.totals.sessions).toBe(2)
  })

  it('takes the streak from lib/metrics/streak over the past history', () => {
    expect(data.streak).toEqual(streak(['2026-09-16', '2026-09-20', '2026-09-21', TODAY], NOW))
  })

  it('splits the heart rate zones of today', () => {
    expect(data.zones.warmSeconds + data.zones.peakSeconds).toBeGreaterThan(0)
  })

  it('returns zero zones when today has no entry', () => {
    const empty = analyse([], [], 'day', TODAY, NOW, 12000)
    expect(empty.zones).toEqual({
      warmSeconds: 0,
      fatBurnSeconds: 0,
      cardioSeconds: 0,
      peakSeconds: 0,
    })
  })
})

describe('trendWord', () => {
  it('says rising when the last value is above the first', () => {
    expect(trendWord([1, 3])).toBe('rising')
  })

  it('says falling when the last value is below the first', () => {
    expect(trendWord([3, 1])).toBe('falling')
  })

  it('says steady when the first and last match', () => {
    expect(trendWord([2, 5, 2])).toBe('steady')
  })

  it('says one day logged for a single value', () => {
    expect(trendWord([2])).toBe('one day logged')
  })

  it('says one day logged for no value', () => {
    expect(trendWord([])).toBe('one day logged')
  })
})

describe('the number helpers', () => {
  it('drops nulls', () => {
    expect(presentValues([1, null, 2])).toEqual([1, 2])
  })

  it('formats a weight to one decimal', () => {
    expect(formatKg(73.44)).toBe('73.4')
  })

  it('signs a gain with a plus', () => {
    expect(signedKg(0.4)).toBe('+0.4')
  })

  it('signs a loss with a true minus sign', () => {
    expect(signedKg(-0.6)).toBe('−0.6')
  })

  it('writes no sign for no change', () => {
    expect(signedKg(0)).toBe('0.0')
  })

  it('lists counts with thousands separators', () => {
    expect(countList([9120, 620])).toBe('9,120, 620')
  })

  it('adds the values', () => {
    expect(sum([1, 2, 3])).toBe(6)
  })
})

describe('dayTick', () => {
  it('writes the weekday initial on the week', () => {
    expect(dayTick('2026-09-21', 'week')).toBe('M')
    expect(dayTick('2026-09-27', 'week')).toBe('S')
  })

  it('writes the weekday and the date on the day tab', () => {
    expect(dayTick(TODAY, 'day')).toBe('Wed 23')
  })

  it('writes the 1st, 8th, 15th, 22nd and 29th on the month, and nothing else', () => {
    expect(dayTick('2026-09-08', 'month')).toBe('8')
    expect(dayTick('2026-09-09', 'month')).toBe('')
  })
})

describe('tickDates', () => {
  it('keeps the five labelled dates of a month', () => {
    const month = analyse([], [], 'month', TODAY, NOW, 12000)
    expect(tickDates(month.days, 'month')).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ])
  })

  it('keeps every date of a week', () => {
    const week = analyse([], [], 'week', TODAY, NOW, 12000)
    expect(tickDates(week.days, 'week')).toHaveLength(7)
  })
})

describe('loggedDays', () => {
  it('counts the days with an entry, whatever they hold', () => {
    const week = analyse([entryOn(TODAY, { steps: null })], [], 'week', TODAY, NOW, 12000)
    expect(loggedDays(week.days)).toBe(1)
  })
})

describe('averagePerLoggedDay', () => {
  it('divides the total by the logged days', () => {
    expect(averagePerLoggedDay(4940, 7)).toBeCloseTo(705.71, 2)
  })

  it('returns null for fewer than two logged days', () => {
    expect(averagePerLoggedDay(705, 1)).toBeNull()
    expect(averagePerLoggedDay(0, 0)).toBeNull()
  })
})

describe('highestIndex', () => {
  it('finds the first highest value', () => {
    expect(highestIndex([3, null, 9, 9, 1])).toBe(2)
  })

  it('returns -1 when every value is null', () => {
    expect(highestIndex([null, null])).toBe(-1)
  })
})

describe('lastIndex', () => {
  it('finds the last value that is not null', () => {
    expect(lastIndex([1, 2, null])).toBe(1)
  })

  it('returns -1 when every value is null', () => {
    expect(lastIndex([null])).toBe(-1)
  })
})
