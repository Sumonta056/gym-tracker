import type { DailyEntryInput } from '../schema/dailyEntry'

export type HeartRateSession = Pick<
  DailyEntryInput,
  'gym_seconds' | 'avg_heart_rate' | 'max_heart_rate'
>

export interface HeartRateZones {
  warmSeconds: number
  fatBurnSeconds: number
  cardioSeconds: number
  peakSeconds: number
}

export const ZONE_FLOORS = {
  fatBurn: 0.6,
  cardio: 0.7,
  peak: 0.85,
} as const

const NO_ZONES: HeartRateZones = {
  warmSeconds: 0,
  fatBurnSeconds: 0,
  cardioSeconds: 0,
  peakSeconds: 0,
}

function shareBelow(beat: number, low: number, high: number): number {
  if (high <= low) {
    return 0
  }

  return Math.max(0, (beat - low) / (high - low))
}

export function heartRateZones(session: HeartRateSession): HeartRateZones {
  const seconds = Math.max(0, Math.trunc(session.gym_seconds ?? 0))
  const average = session.avg_heart_rate
  const peak = session.max_heart_rate

  if (seconds === 0 || average === null || peak === null || peak <= 0) {
    return { ...NO_ZONES }
  }

  const high = Math.max(average, peak)
  const low = Math.max(0, 2 * average - high)

  const belowFatBurn = Math.round(seconds * shareBelow(ZONE_FLOORS.fatBurn * high, low, high))
  const belowCardio = Math.round(seconds * shareBelow(ZONE_FLOORS.cardio * high, low, high))
  const belowPeak = Math.round(seconds * shareBelow(ZONE_FLOORS.peak * high, low, high))

  return {
    warmSeconds: belowFatBurn,
    fatBurnSeconds: belowCardio - belowFatBurn,
    cardioSeconds: belowPeak - belowCardio,
    peakSeconds: seconds - belowPeak,
  }
}
