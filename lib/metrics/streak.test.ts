import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { streak } from './streak'

const NOON = new Date('2026-09-23T12:00:00.000Z')

describe('streak', () => {
  it('returns 0 and 0 for no entries', () => {
    expect(streak([], NOON)).toEqual({ current: 0, longest: 0 })
  })

  it('returns a current streak of 1 for one entry today', () => {
    expect(streak(['2026-09-23'], NOON).current).toBe(1)
  })

  it('returns a current streak of 1 for one entry yesterday and none today', () => {
    expect(streak(['2026-09-22'], NOON).current).toBe(1)
  })

  it('counts an unbroken run that reaches today', () => {
    expect(streak(['2026-09-21', '2026-09-22', '2026-09-23'], NOON).current).toBe(3)
  })

  it('breaks the current streak on a gap of one day', () => {
    expect(streak(['2026-09-19', '2026-09-20', '2026-09-21'], NOON).current).toBe(0)
  })

  it('breaks the current streak on a gap of three days', () => {
    expect(streak(['2026-09-17', '2026-09-18', '2026-09-19'], NOON).current).toBe(0)
  })

  it('keeps the longest streak after the current one breaks', () => {
    expect(streak(['2026-09-17', '2026-09-18', '2026-09-19'], NOON).longest).toBe(3)
  })

  it('counts two entries on the same date as one day', () => {
    const dates = ['2026-09-22', '2026-09-22', '2026-09-23']

    expect(streak(dates, NOON)).toEqual({ current: 2, longest: 2 })
  })

  it('keeps a run unbroken across a month boundary', () => {
    const dates = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']

    expect(streak(dates, NOON).longest).toBe(4)
  })

  it('reads the dates in any order', () => {
    const dates = ['2026-09-23', '2026-09-21', '2026-09-22']

    expect(streak(dates, NOON)).toEqual({ current: 3, longest: 3 })
  })

  it('reports the longest of two separate runs', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-10', '2026-09-11', '2026-09-12']

    expect(streak(dates, NOON).longest).toBe(3)
  })

  it('ignores a malformed date instead of throwing', () => {
    expect(streak(['nope', '2026-09-23'], NOON)).toEqual({ current: 1, longest: 1 })
  })

  it('leaves the current streak at 0 when every entry is in the future', () => {
    expect(streak(['2026-09-25'], NOON)).toEqual({ current: 0, longest: 1 })
  })

  it('does not count a future entry towards the current streak', () => {
    const dates = ['2026-09-22', '2026-09-23', '2026-09-24']

    expect(streak(dates, NOON).current).toBe(2)
  })

  it('defaults to the real clock when no instant is given', () => {
    expect(() => streak([])).not.toThrow()
    expect(streak([])).toEqual({ current: 0, longest: 0 })
  })
})

describe('streak across a time zone edge', () => {
  const original = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })

  afterAll(() => {
    process.env.TZ = original
  })

  it('counts an entry logged at 23:30 local time for that local day', () => {
    const late = new Date('2026-09-24T03:30:00.000Z')

    expect(streak(['2026-09-23'], late)).toEqual({ current: 1, longest: 1 })
  })

  it('does not treat the local day as already over at 23:30', () => {
    const late = new Date('2026-09-24T03:30:00.000Z')

    expect(streak(['2026-09-22', '2026-09-23'], late).current).toBe(2)
  })
})
