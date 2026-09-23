import { describe, expect, it } from 'vitest'

import { heartRateZones, ZONE_FLOORS } from './heartRateZones'

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
    expect(heartRateZones(session({ avg_heart_rate: null, max_heart_rate: null }))).toEqual(ZEROS)
  })

  it('returns four zeros when only the average is missing', () => {
    expect(heartRateZones(session({ avg_heart_rate: null }))).toEqual(ZEROS)
  })

  it('returns four zeros when only the peak is missing', () => {
    expect(heartRateZones(session({ max_heart_rate: null }))).toEqual(ZEROS)
  })

  it('returns four zeros for a session with no gym time', () => {
    expect(heartRateZones(session({ gym_seconds: null }))).toEqual(ZEROS)
  })

  it('returns four zeros for a session of zero seconds', () => {
    expect(heartRateZones(session({ gym_seconds: 0 }))).toEqual(ZEROS)
  })

  it('returns four zeros for a peak heart rate of zero', () => {
    expect(heartRateZones(session({ max_heart_rate: 0 }))).toEqual(ZEROS)
  })

  it('splits an hour at 120 average and 180 peak into the four zones', () => {
    expect(heartRateZones(session())).toEqual({
      warmSeconds: 1440,
      fatBurnSeconds: 540,
      cardioSeconds: 810,
      peakSeconds: 810,
    })
  })

  it('adds the four zone shares up to the session length', () => {
    expect(total(heartRateZones(session()))).toBe(3600)
  })

  it('adds up to the session length when the seconds do not divide evenly', () => {
    const odd = [1, 7, 59, 313, 3599, 4271]

    for (const seconds of odd) {
      expect(total(heartRateZones(session({ gym_seconds: seconds })))).toBe(seconds)
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
      const zones = heartRateZones(session({ avg_heart_rate: pair.avg, max_heart_rate: pair.max }))

      expect(total(zones)).toBe(3600)
    }
  })

  it('never returns a negative zone', () => {
    const zones = heartRateZones(session({ gym_seconds: 71, avg_heart_rate: 99 }))

    for (const value of Object.values(zones)) {
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it('puts a flat session at the peak heart rate wholly in the peak zone', () => {
    const zones = heartRateZones(session({ gym_seconds: 600, avg_heart_rate: 180 }))

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
    )

    expect(total(zones)).toBe(600)
    expect(zones.peakSeconds).toBe(600)
  })
})
