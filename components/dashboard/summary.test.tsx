import { describe, expect, it } from 'vitest'

import { heartRateZones } from '../../lib/metrics/heartRateZones'
import { streak } from '../../lib/metrics/streak'
import { entryOn, NOW, PROFILE, TODAY } from '../../tests/fixtures/dashboard'
import { BENCH, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import {
  daysBefore,
  formatCount,
  headerDate,
  NO_LIFTS,
  summarise,
  todayWorkouts,
  weekOf,
  weekRangeLabel,
  weightGap,
} from './summary'

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
    expect(summarise([entry], PROFILE, TODAY, NOW).zones).toEqual(heartRateZones(entry, null))
  })

  it('returns no max for a profile with no heart rate field', () => {
    expect(summarise([], PROFILE, TODAY, NOW).maxHeartRate).toBeNull()
  })

  it('returns the max from the birth year of the profile', () => {
    const profile = { ...PROFILE, birth_year: 1996, max_heart_rate: null }
    expect(summarise([], profile, TODAY, NOW).maxHeartRate).toEqual({ bpm: 190, source: 'age' })
  })

  it('models the zones of today against the max of the profile', () => {
    const entry = entryOn(TODAY, { avg_heart_rate: 150, max_heart_rate: 160, gym_seconds: 3600 })
    const profile = { ...PROFILE, birth_year: 1996, max_heart_rate: null }
    expect(summarise([entry], profile, TODAY, NOW).zones.peakSeconds).toBe(0)
  })

  it('models the zones from the session time when no gym time is typed', () => {
    const entry = entryOn(TODAY, { gym_seconds: null, avg_heart_rate: 150, max_heart_rate: 160 })
    const zones = summarise([entry], PROFILE, TODAY, NOW, {
      ...NO_LIFTS,
      sessions: [sessionOn(TODAY)],
    }).zones
    expect(zones.warmSeconds + zones.fatBurnSeconds + zones.cardioSeconds + zones.peakSeconds).toBe(
      3600,
    )
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

  it('counts a finished session with no typed gym time in the week', () => {
    const entries = [entryOn('2026-09-22', { gym_seconds: null })]
    const lifts = { ...NO_LIFTS, sessions: [sessionOn('2026-09-22')] }
    const week = summarise(entries, PROFILE, TODAY, NOW, lifts).week
    expect(week).toMatchObject({ sessions: 1, gymSeconds: 3600 })
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

  it('carries the unit system from the profile', () => {
    const summary = summarise([], { ...PROFILE, unit_system: 'imperial' }, TODAY, NOW)
    expect(summary.unitSystem).toBe('imperial')
  })
  it('takes the sessions per week goal from the profile', () => {
    expect(summarise([], { ...PROFILE, sessions_per_week_goal: 4 }, TODAY, NOW).sessionsGoal).toBe(
      4,
    )
  })

  it('gives no sessions goal for a profile with no goal field', () => {
    expect(summarise([], PROFILE, TODAY, NOW).sessionsGoal).toBeNull()
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

describe('weekRangeLabel', () => {
  it('names both months across a month end', () => {
    expect(weekRangeLabel({ from: '2026-09-29', to: '2026-10-05' })).toBe('29 Sep – 5 Oct')
  })

  it('names the month once inside one month', () => {
    expect(weekRangeLabel({ from: '2026-09-21', to: '2026-09-27' })).toBe('21 – 27 Sep')
  })
})

describe('summarise for a full Today', () => {
  it('takes gym time from the sessions when none is typed', () => {
    const lifts = { ...NO_LIFTS, sessions: [sessionOn(TODAY)] }
    const entries = [entryOn(TODAY, { gym_seconds: null })]

    expect(summarise(entries, PROFILE, TODAY, NOW, lifts).gym).toEqual({
      seconds: 3600,
      source: 'sessions',
    })
  })

  it('keeps a typed gym time over the sessions', () => {
    const lifts = { ...NO_LIFTS, sessions: [sessionOn(TODAY)] }
    const entries = [entryOn(TODAY, { gym_seconds: 1200 })]

    expect(summarise(entries, PROFILE, TODAY, NOW, lifts).gym).toEqual({
      seconds: 1200,
      source: 'typed',
    })
  })

  it('adds no session of another day to the gym time of today', () => {
    const lifts = { ...NO_LIFTS, sessions: [sessionOn('2026-09-22')] }

    expect(summarise([], PROFILE, TODAY, NOW, lifts).gym.source).toBe('none')
  })

  it('has no gym time and no workout with no lifts', () => {
    const summary = summarise([], PROFILE, TODAY, NOW)

    expect([summary.gym, summary.workouts]).toEqual([{ seconds: 0, source: 'none' }, []])
  })

  it('takes the calorie goal, the walk goal and the target weight from the profile', () => {
    const profile = {
      ...PROFILE,
      calorie_goal: 800,
      walk_goal_seconds: 3600,
      target_weight_kg: 71.25,
    }
    const summary = summarise([entryOn(TODAY)], profile, TODAY, NOW)

    expect([summary.calorieGoal, summary.walkGoalSeconds, summary.targetWeightKg]).toEqual([
      800, 3600, 71.25,
    ])
  })

  it('has no goal for a profile with no goal field', () => {
    const summary = summarise([entryOn(TODAY)], PROFILE, TODAY, NOW)

    expect([summary.calorieGoal, summary.walkGoalSeconds]).toEqual([null, null])
  })

  it('measures the gap from the latest weight to the target', () => {
    const profile = { ...PROFILE, target_weight_kg: 71.25 }

    expect(summarise([entryOn(TODAY, { weight_kg: 73.65 })], profile, TODAY, NOW).weightGapKg).toBe(
      2.4,
    )
  })
})

describe('todayWorkouts', () => {
  const morning = sessionOn(TODAY, {
    id: '00000000-0000-4000-8000-0000000000e1',
    started_at: `${TODAY}T07:00:00.000Z`,
    ended_at: `${TODAY}T08:00:00.000Z`,
  })
  const evening = sessionOn(TODAY, {
    id: '00000000-0000-4000-8000-0000000000e2',
    started_at: `${TODAY}T18:00:00.000Z`,
    ended_at: `${TODAY}T18:30:00.000Z`,
  })

  it('lists the finished sessions of today oldest first, with their stats', () => {
    const sets = [liftSet(evening, BENCH, 10, 60)]
    const rows = todayWorkouts({ sessions: [evening, morning], sets, earlierSets: [] }, TODAY)

    expect(
      rows.map((row) => [row.session.id, row.stats.setCount, row.stats.durationSeconds]),
    ).toEqual([
      [morning.id, 0, 3600],
      [evening.id, 1, 1800],
    ])
  })

  it('leaves out a running session and a soft-deleted session', () => {
    const running = sessionOn(TODAY, { id: crypto.randomUUID(), status: 'active', ended_at: null })
    const removed = sessionOn(TODAY, {
      id: crypto.randomUUID(),
      deleted_at: `${TODAY}T20:00:00.000Z`,
    })

    expect(todayWorkouts({ ...NO_LIFTS, sessions: [running, removed] }, TODAY)).toEqual([])
  })

  it('leaves out a session of another day', () => {
    expect(todayWorkouts({ ...NO_LIFTS, sessions: [sessionOn('2026-09-22')] }, TODAY)).toEqual([])
  })

  it('counts a new record against the earlier sets', () => {
    const earlier = [liftSet(sessionOn('2026-09-20'), BENCH, 8, 60)]
    const sets = [liftSet(evening, BENCH, 5, 65)]
    const [row] = todayWorkouts({ sessions: [evening], sets, earlierSets: earlier }, TODAY)

    expect(row?.stats.newRecords).toEqual([{ exerciseId: BENCH, weightKg: 65, reps: 5 }])
  })
})

describe('weightGap', () => {
  it('is the positive gap to a lower target', () => {
    expect(weightGap(73.65, 71.25)).toBe(2.4)
  })

  it('is the positive gap to a higher target', () => {
    expect(weightGap(70, 72.5)).toBe(2.5)
  })

  it('is null with no target or no weight', () => {
    expect([weightGap(70, null), weightGap(null, 72)]).toEqual([null, null])
  })
})
