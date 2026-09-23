import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { localDayNumber, toDayNumber } from './day'

describe('toDayNumber', () => {
  it('returns null for a string that is not a date', () => {
    expect(toDayNumber('not a date')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(toDayNumber('')).toBeNull()
  })

  it('returns null for a day that does not exist in the month', () => {
    expect(toDayNumber('2026-02-30')).toBeNull()
  })

  it('returns null for a two digit year that would be read as nineteen hundred', () => {
    expect(toDayNumber('0099-01-01')).toBeNull()
  })

  it('numbers two consecutive days one apart', () => {
    expect(toDayNumber('2026-09-24')).toBe((toDayNumber('2026-09-23') ?? 0) + 1)
  })

  it('numbers the first of a month one after the last of the month before', () => {
    expect(toDayNumber('2026-10-01')).toBe((toDayNumber('2026-09-30') ?? 0) + 1)
  })

  it('numbers the leap day one after the twenty eighth of february', () => {
    expect(toDayNumber('2028-02-29')).toBe((toDayNumber('2028-02-28') ?? 0) + 1)
  })

  it('numbers a whole calendar year as 365 days', () => {
    expect((toDayNumber('2027-01-01') ?? 0) - (toDayNumber('2026-01-01') ?? 0)).toBe(365)
  })
})

describe('localDayNumber', () => {
  const original = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })

  afterAll(() => {
    process.env.TZ = original
  })

  it('counts 23:30 local time as the local day, not the next utc day', () => {
    const late = new Date('2026-09-24T03:30:00.000Z')

    expect(late.getUTCDate()).toBe(24)
    expect(localDayNumber(late)).toBe(toDayNumber('2026-09-23'))
  })

  it('counts a morning instant as the same local day', () => {
    expect(localDayNumber(new Date('2026-09-23T14:00:00.000Z'))).toBe(toDayNumber('2026-09-23'))
  })
})
