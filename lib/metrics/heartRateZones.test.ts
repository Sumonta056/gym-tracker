import { describe, expect, it } from 'vitest'

import { heartRateZones, resolveMaxHeartRate, ZONE_FLOORS, zoneBands } from './heartRateZones'

import type { HeartRateSession } from './heartRateZones'

const ZEROS = { warmSeconds: 0, fatBurnSeconds: 0, cardioSeconds: 0, peakSeconds: 0 }

function session(patch: Partial<HeartRateSession> = {}): HeartRateSession {
  return { gym_seconds: 3600, avg_heart_rate: 120, max_heart_rate: 180, ...patch }
}

function total(zones: ReturnType<typeof heartRateZones>): number {
  return zones.warmSeconds + zones.fatBurnSeconds + zones.cardioSeconds + zones.peakSeconds
}

describe('ZONE_FLOORS', () => {
  it('rises from fat burn through cardio to peak', () => {
    expect(ZONE_FLOORS.fatBurn).toBeLessThan(ZONE_FLOORS.cardio)
    expect(ZONE_FLOORS.cardio).toBeLessThan(ZONE_FLOORS.peak)
  })
})

describe('heartRateZones', () => {
  it('returns four zeros for a session with no heart rate', () => {
    expect(heartRateZones(session({ avg_heart_rate: null, max_heart_rate: null }), null)).toEqual(
      ZEROS,
    )
  })

  it('returns four zeros when only the average is missing', () => {
    expect(heartRateZones(session({ avg_heart_rate: null }), null)).toEqual(ZEROS)
  })

  it('returns four zeros when only the peak is missing', () => {
    expect(heartRateZones(session({ max_heart_rate: null }), null)).toEqual(ZEROS)
  })

  it('returns four zeros for a session with no gym time', () => {
    expect(heartRateZones(session({ gym_seconds: null }), null)).toEqual(ZEROS)
  })

  it('returns four zeros for a session of zero seconds', () => {
    expect(heartRateZones(session({ gym_seconds: 0 }), null)).toEqual(ZEROS)
  })

  it('returns four zeros for a peak heart rate of zero', () => {
    expect(heartRateZones(session({ max_heart_rate: 0 }), null)).toEqual(ZEROS)
  })

  it('splits an hour at 120 average and 180 peak into the four zones', () => {
    expect(heartRateZones(session(), null)).toEqual({
      warmSeconds: 1440,
      fatBurnSeconds: 540,
      cardioSeconds: 810,
      peakSeconds: 810,
    })
  })

  it('adds the four zone shares up to the session length', () => {
    expect(total(heartRateZones(session(), null))).toBe(3600)
  })

  it('adds up to the session length when the seconds do not divide evenly', () => {
    const odd = [1, 7, 59, 313, 3599, 4271]

    for (const seconds of odd) {
      expect(total(heartRateZones(session({ gym_seconds: seconds }), null))).toBe(seconds)
    }
  })

  it('adds up to the session length for any pair of heart rates', () => {
    const pairs = [
      { avg: 60, max: 60 },
      { avg: 90, max: 200 },
      { avg: 110, max: 111 },
      { avg: 150, max: 152 },
      { avg: 40, max: 230 },
    ]

    for (const pair of pairs) {
      const zones = heartRateZones(
        session({ avg_heart_rate: pair.avg, max_heart_rate: pair.max }),
        null,
      )

      expect(total(zones)).toBe(3600)
    }
  })

  it('never returns a negative zone', () => {
    const zones = heartRateZones(session({ gym_seconds: 71, avg_heart_rate: 99 }), null)

    for (const value of Object.values(zones)) {
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it('puts a flat session at the peak heart rate wholly in the peak zone', () => {
    const zones = heartRateZones(session({ gym_seconds: 600, avg_heart_rate: 180 }), null)

    expect(zones).toEqual({
      warmSeconds: 0,
      fatBurnSeconds: 0,
      cardioSeconds: 0,
      peakSeconds: 600,
    })
  })

  it('clamps the low end of the range at zero when the average sits far below the peak', () => {
    const zones = heartRateZones(
      session({ gym_seconds: 1000, avg_heart_rate: 40, max_heart_rate: 200 }),
      null,
    )

    expect(zones).toEqual({
      warmSeconds: 600,
      fatBurnSeconds: 100,
      cardioSeconds: 150,
      peakSeconds: 150,
    })
  })

  it('reads a peak below the average as the average, rather than throwing', () => {
    const zones = heartRateZones(
      session({ gym_seconds: 600, avg_heart_rate: 150, max_heart_rate: 140 }),
      null,
    )

    expect(total(zones)).toBe(600)
    expect(zones.peakSeconds).toBe(600)
  })
})

describe('resolveMaxHeartRate', () => {
  it('uses the override when the profile holds both fields', () => {
    expect(resolveMaxHeartRate({ max_heart_rate: 175, birth_year: 1996 }, '2026-09-23')).toEqual({
      bpm: 175,
      source: 'override',
    })
  })

  it('takes 220 minus the age when only the birth year is set', () => {
    expect(resolveMaxHeartRate({ max_heart_rate: null, birth_year: 1996 }, '2026-09-23')).toEqual({
      bpm: 190,
      source: 'age',
    })
  })

  it('counts the age from the year of today', () => {
    expect(resolveMaxHeartRate({ max_heart_rate: null, birth_year: 1996 }, '2027-01-01')).toEqual({
      bpm: 189,
      source: 'age',
    })
  })

  it('returns null when the profile holds neither field', () => {
    expect(resolveMaxHeartRate({ max_heart_rate: null, birth_year: null }, '2026-09-23')).toBeNull()
  })
})

describe('heartRateZones with a maximum heart rate', () => {
  it('keeps an hour at 150 average and 160 peak out of the peak zone with a max of 190', () => {
    expect(heartRateZones(session({ avg_heart_rate: 150, max_heart_rate: 160 }), 190)).toEqual({
      warmSeconds: 0,
      fatBurnSeconds: 0,
      cardioSeconds: 3600,
      peakSeconds: 0,
    })
  })

  it('puts the same hour wholly in the peak zone with no max, as before', () => {
    expect(
      heartRateZones(session({ avg_heart_rate: 150, max_heart_rate: 160 }), null).peakSeconds,
    ).toBe(3600)
  })

  it('splits an hour at 120 average and 180 peak against a max of 190', () => {
    expect(heartRateZones(session(), 190)).toEqual({
      warmSeconds: 1620,
      fatBurnSeconds: 570,
      cardioSeconds: 855,
      peakSeconds: 555,
    })
  })

  it('fills the peak zone when the session peak passes the max', () => {
    expect(heartRateZones(session({ avg_heart_rate: 170, max_heart_rate: 200 }), 175)).toEqual({
      warmSeconds: 0,
      fatBurnSeconds: 0,
      cardioSeconds: 525,
      peakSeconds: 3075,
    })
  })

  it('puts a flat session below the cardio floor in the fat burn zone', () => {
    expect(
      heartRateZones(session({ gym_seconds: 600, avg_heart_rate: 125, max_heart_rate: 125 }), 190),
    ).toEqual({ warmSeconds: 0, fatBurnSeconds: 600, cardioSeconds: 0, peakSeconds: 0 })
  })

  it('adds up to the session length for any max', () => {
    for (const max of [100, 150, 190, 230]) {
      expect(total(heartRateZones(session(), max))).toBe(3600)
    }
  })
})

describe('zoneBands', () => {
  it('splits a max of 190 at 114, 133 and 162 beats', () => {
    expect(zoneBands(190)).toEqual([
      { zone: 'warm', fromBpm: 0, toBpm: 113 },
      { zone: 'fatBurn', fromBpm: 114, toBpm: 132 },
      { zone: 'cardio', fromBpm: 133, toBpm: 161 },
      { zone: 'peak', fromBpm: 162, toBpm: null },
    ])
  })

  it('rounds a half beat up', () => {
    expect(zoneBands(175).map((band) => band.fromBpm)).toEqual([0, 105, 123, 149])
  })

  it('leaves no gap and no overlap between the bands', () => {
    for (let max = 100; max <= 230; max += 1) {
      const bands = zoneBands(max)

      for (let index = 1; index < bands.length; index += 1) {
        expect(bands[index]?.fromBpm).toBe((bands[index - 1]?.toBpm ?? 0) + 1)
      }
    }
  })
})
