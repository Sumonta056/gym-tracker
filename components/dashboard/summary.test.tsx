import { describe, expect, it } from 'vitest'

import { heartRateZones } from '../../lib/metrics/heartRateZones'
import { streak } from '../../lib/metrics/streak'
import { entryOn, NOW, PROFILE, TODAY } from '../../tests/fixtures/dashboard'

import { daysBefore, formatCount, headerDate, summarise, weekOf } from './summary'

describe('weekOf', () => {
  it('runs from the Monday to the Sunday around a Wednesday', () => {
    expect(weekOf('2026-09-23')).toEqual({ from: '2026-09-21', to: '2026-09-27' })
  })

  it('starts on the day itself when the day is a Monday', () => {
    expect(weekOf('2026-09-21')).toEqual({ from: '2026-09-21', to: '2026-09-27' })
  })

  it('ends on the day itself when the day is a Sunday', () => {
    expect(weekOf('2026-09-27')).toEqual({ from: '2026-09-21', to: '2026-09-27' })
  })

  it('handles a week that crosses a month end', () => {
    expect(weekOf('2026-10-01')).toEqual({ from: '2026-09-28', to: '2026-10-04' })
  })
})

describe('daysBefore', () => {
  it('counts back across a month boundary', () => {
    expect(daysBefore('2026-10-02', 13)).toBe('2026-09-19')
  })
})

describe('summarise', () => {
  it('picks the entry for today', () => {
    const entries = [entryOn('2026-09-22'), entryOn(TODAY, { steps: 100 })]
    expect(summarise(entries, PROFILE, TODAY, NOW).entry?.steps).toBe(100)
  })

  it('has no entry when today is not logged', () => {
    expect(summarise([entryOn('2026-09-22')], PROFILE, TODAY, NOW).entry).toBeUndefined()
  })

  it('takes the current streak from lib/metrics/streak', () => {
    const dates = ['2026-09-15', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']
    const entries = dates.map((date) => entryOn(date))
    expect(summarise(entries, PROFILE, TODAY, NOW).streak).toBe(streak(dates, NOW).current)
  })

  it('ignores an entry dated after today', () => {
    const entries = [entryOn(TODAY, { weight_kg: 70 }), entryOn('2026-09-24', { weight_kg: 90 })]
    expect(summarise(entries, PROFILE, TODAY, NOW).latestWeightKg).toBe(70)
  })

  it('models the zones from the entry for today', () => {
    const entry = entryOn(TODAY)
    expect(summarise([entry], PROFILE, TODAY, NOW).zones).toEqual(heartRateZones(entry))
  })

  it('reports no zone time when today is not logged', () => {
    const zones = summarise([], PROFILE, TODAY, NOW).zones
    expect(zones.warmSeconds + zones.fatBurnSeconds + zones.cardioSeconds + zones.peakSeconds).toBe(
      0,
    )
  })

  it('totals only the days of the current week', () => {
    const entries = [
      entryOn('2026-09-20', { steps: 1000 }),
      entryOn('2026-09-21', { steps: 200 }),
      entryOn(TODAY, { steps: 30 }),
    ]
    expect(summarise(entries, PROFILE, TODAY, NOW).week.steps).toBe(230)
  })

  it('keeps the latest logged weight when the newest days have none', () => {
    const entries = [
      entryOn('2026-09-21', { weight_kg: 72.5 }),
      entryOn(TODAY, { weight_kg: null }),
    ]
    expect(summarise(entries, PROFILE, TODAY, NOW).latestWeightKg).toBe(72.5)
  })

  it('has no weight when none was ever logged', () => {
    expect(
      summarise([entryOn(TODAY, { weight_kg: null })], PROFILE, TODAY, NOW).latestWeightKg,
    ).toBeNull()
  })

  it('draws the weight trend from the last fourteen days, oldest first', () => {
    const entries = [
      entryOn(TODAY, { weight_kg: 73 }),
      entryOn('2026-09-09', { weight_kg: 99 }),
      entryOn('2026-09-10', { weight_kg: 74 }),
      entryOn('2026-09-15', { weight_kg: null }),
    ]
    expect(summarise(entries, PROFILE, TODAY, NOW).weightTrend).toEqual([74, 73])
  })

  it('carries the step goal and the name from the profile', () => {
    const summary = summarise([], { ...PROFILE, step_goal: 9000 }, TODAY, NOW)
    expect(summary.stepGoal).toBe(9000)
    expect(summary.displayName).toBe('Sumonta')
  })
})

describe('headerDate', () => {
  it('names the weekday and the day of the month', () => {
    expect(headerDate('2026-09-13')).toEqual({ weekday: 'Sunday', dayMonth: '13 September' })
  })
})

describe('formatCount', () => {
  it('groups thousands with a comma', () => {
    expect(formatCount(12480)).toBe('12,480')
  })
})
