import { describe, expect, it } from 'vitest'

import { GAP_BUCKET_CAP, sessionGaps } from './sessionGaps'

const SEPTEMBER = [
  '2026-09-02',
  '2026-09-03',
  '2026-09-06',
  '2026-09-09',
  '2026-09-12',
  '2026-09-13',
]

function counts(dates: readonly string[]): number[] {
  return sessionGaps(dates).histogram.map((bucket) => bucket.count)
}

describe('sessionGaps', () => {
  it('gives the gaps 1, 3, 3, 3, 1 for the real dates from 2 to 13 September', () => {
    expect(sessionGaps(SEPTEMBER).gaps).toEqual([1, 3, 3, 3, 1])
  })

  it('gives the same gaps when the dates arrive out of order', () => {
    expect(sessionGaps([...SEPTEMBER].reverse()).gaps).toEqual([1, 3, 3, 3, 1])
  })

  it('returns no gap for one session', () => {
    expect(sessionGaps(['2026-09-02']).gaps).toEqual([])
  })

  it('returns no gap for no session', () => {
    expect(sessionGaps([]).gaps).toEqual([])
  })

  it('counts two sessions on one date as one day', () => {
    expect(sessionGaps(['2026-09-02', '2026-09-02', '2026-09-05']).gaps).toEqual([3])
  })

  it('returns no gap for two sessions on the same date only', () => {
    expect(sessionGaps(['2026-09-02', '2026-09-02']).gaps).toEqual([])
  })

  it('skips a malformed or impossible date', () => {
    expect(sessionGaps(['2026-09-02', 'not a date', '2026-02-30', '2026-09-04']).gaps).toEqual([2])
  })

  it('counts a gap across a month end', () => {
    expect(sessionGaps(['2026-08-30', '2026-09-02']).gaps).toEqual([3])
  })

  it('counts a gap across a daylight saving change as whole days', () => {
    expect(sessionGaps(['2026-03-28', '2026-03-30']).gaps).toEqual([2])
  })

  it('caps the histogram at 5 or more days', () => {
    expect(GAP_BUCKET_CAP).toBe(5)
  })

  it('returns five empty buckets for no gap', () => {
    expect(sessionGaps([]).histogram).toEqual([
      { days: 1, count: 0 },
      { days: 2, count: 0 },
      { days: 3, count: 0 },
      { days: 4, count: 0 },
      { days: 5, count: 0 },
    ])
  })

  it('buckets the September gaps as two of 1 day and three of 3 days', () => {
    expect(counts(SEPTEMBER)).toEqual([2, 0, 3, 0, 0])
  })

  it('puts a gap of 5 days in the last bucket', () => {
    expect(counts(['2026-09-01', '2026-09-06'])).toEqual([0, 0, 0, 0, 1])
  })

  it('puts a gap longer than 5 days in the last bucket', () => {
    expect(counts(['2026-08-12', '2026-08-19', '2026-09-02'])).toEqual([0, 0, 0, 0, 2])
  })

  it('puts a gap of 4 days in the fourth bucket', () => {
    expect(counts(['2026-08-19', '2026-08-23'])).toEqual([0, 0, 0, 1, 0])
  })
})
