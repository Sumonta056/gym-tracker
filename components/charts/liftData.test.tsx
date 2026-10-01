import { describe, expect, it } from 'vitest'

import { TODAY } from '../../tests/fixtures/dashboard'
import { BENCH, EXERCISES, LAT, LEG, liftSet, ROW, sessionOn } from '../../tests/fixtures/lifts'

import {
  analyseLifts,
  liftRecords,
  pickedCount,
  sessionTick,
  sessionTicks,
  shownPicked,
  togglePicked,
} from './liftData'

import type { LiftOption } from './liftData'

const lastWeek = sessionOn('2026-09-16')
const monday = sessionOn('2026-09-21')
const today = sessionOn(TODAY)
const sessions = [lastWeek, monday, today]
const sets = [
  liftSet(lastWeek, BENCH, 10, 50),
  liftSet(monday, BENCH, 10, 50),
  liftSet(monday, LAT, 10, 40),
  liftSet(today, LAT, 10, 40),
]

describe('analyseLifts', () => {
  it('keeps the sessions of the range, oldest first, with their volume', () => {
    const lifts = analyseLifts(sessions, sets, EXERCISES, 'week', TODAY)

    expect(lifts.sessions).toEqual([
      { id: monday.id, date: '2026-09-21' },
      { id: today.id, date: TODAY },
    ])
    expect(lifts.volumes.map((item) => item.volume)).toEqual([900, 400])
  })

  it('compares the volume of this week with the week before', () => {
    expect(analyseLifts(sessions, sets, EXERCISES, 'week', TODAY).weekChange).toBe(160)
  })

  it('leaves out a session of last week after the weekday of today', () => {
    const friday = sessionOn('2026-09-18')
    const lifts = analyseLifts(
      [...sessions, friday],
      [...sets, liftSet(friday, BENCH, 10, 100)],
      EXERCISES,
      'week',
      TODAY,
    )

    expect(lifts.weekChange).toBe(160)
  })

  it('compares the same two weeks on the month range', () => {
    const lifts = analyseLifts(sessions, sets, EXERCISES, 'month', TODAY)

    expect(lifts.weekChange).toBe(160)
    expect(lifts.sessions).toHaveLength(3)
  })

  it('gives no week change when last week holds no volume', () => {
    expect(analyseLifts([monday], sets, EXERCISES, 'week', TODAY).weekChange).toBeNull()
  })

  it('offers the exercises trained in the range, the most sessions first', () => {
    const lifts = analyseLifts(sessions, sets, EXERCISES, 'week', TODAY)

    expect(lifts.options.map((option) => option.name)).toEqual(['Lat pulldown', 'Bench press'])
    expect(lifts.options[0]?.points).toEqual({ [monday.id]: 53.33, [today.id]: 53.33 })
  })

  it('reads every session for the records, whatever the range', () => {
    const lifts = analyseLifts(sessions, sets, EXERCISES, 'day', TODAY)

    expect(lifts.records.map((record) => [record.name, record.at.slice(0, 10)])).toEqual([
      ['Bench press', '2026-09-16'],
      ['Lat pulldown', '2026-09-21'],
    ])
  })
})

describe('liftRecords', () => {
  it('matches a hand calculation for one exercise', () => {
    const session = sessionOn('2026-09-12')
    const best = liftSet(session, BENCH, 8, 45)
    const names = new Map([[BENCH, 'Bench press']])

    expect(
      liftRecords(
        [liftSet(session, BENCH, 10, 40), best, liftSet(session, BENCH, 10, 42.5)],
        names,
      ),
    ).toEqual([
      {
        exerciseId: BENCH,
        name: 'Bench press',
        loadKg: 45,
        reps: 8,
        at: best.completed_at,
        volumeKg: 425,
        oneRepMaxKg: 57,
      },
    ])
  })

  it('leaves out an exercise with no name on this device and one with no load', () => {
    const session = sessionOn('2026-09-12')
    const names = new Map([[LEG, 'Leg press']])

    expect(
      liftRecords([liftSet(session, ROW, 10, 40), liftSet(session, LEG, 10, null)], names),
    ).toEqual([])
  })

  it('gives no one-rep max for a best load of 0', () => {
    const session = sessionOn('2026-09-12')
    const names = new Map([[LEG, 'Leg press']])

    expect(liftRecords([liftSet(session, LEG, 10, 0)], names)[0]?.oneRepMaxKg).toBeNull()
  })

  it('orders two exercises with one name by id', () => {
    const session = sessionOn('2026-09-12')
    const names = new Map([
      [LAT, 'Row'],
      [BENCH, 'Row'],
    ])

    expect(
      liftRecords([liftSet(session, LAT, 5, 40), liftSet(session, BENCH, 5, 40)], names).map(
        (record) => record.exerciseId,
      ),
    ).toEqual([BENCH, LAT])
  })
})

describe('sessionTick', () => {
  it('writes the weekday and the date', () => {
    expect(sessionTick('2026-09-02')).toBe('Wed 2')
  })
})

describe('sessionTicks', () => {
  it('labels every session up to six', () => {
    expect(sessionTicks(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('labels every second session from seven to twelve', () => {
    expect(sessionTicks(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual(['a', 'c', 'e', 'g'])
  })

  it('returns no tick for no session', () => {
    expect(sessionTicks([])).toEqual([])
  })
})

describe('togglePicked', () => {
  it('adds an exercise', () => {
    expect(togglePicked(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('frees the slot of a picked exercise, so the others keep their colour', () => {
    expect(togglePicked(['a', 'b'], 'a')).toEqual([null, 'b'])
  })

  it('fills the first free slot', () => {
    expect(togglePicked([null, 'b'], 'c')).toEqual(['c', 'b'])
  })

  it('adds nothing past three', () => {
    expect(togglePicked(['a', 'b', 'c'], 'd')).toEqual(['a', 'b', 'c'])
  })
})

describe('shownPicked', () => {
  const options: LiftOption[] = ['a', 'b', 'c'].map((id) => ({ id, name: id, points: {} }))

  it('shows the first two options before the user picks', () => {
    expect(shownPicked(options, null)).toEqual(['a', 'b'])
  })

  it('keeps the picks that the range still offers, in their slots', () => {
    expect(shownPicked(options, ['z', 'c'])).toEqual([null, 'c'])
  })

  it('falls back to the first two when the range offers none of the picks', () => {
    expect(shownPicked(options, ['z'])).toEqual(['a', 'b'])
  })

  it('shows nothing when the user cleared every pick', () => {
    expect(shownPicked(options, [null, null])).toEqual([null, null])
    expect(pickedCount(shownPicked(options, []))).toBe(0)
  })
})
