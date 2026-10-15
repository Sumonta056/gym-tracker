import type { DailyEntryInput } from '../schema/dailyEntry'
import type { ProfileInput } from '../schema/profile'

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

export type MaxHeartRate = { bpm: number; source: 'override' | 'age' }

export type ZoneName = 'warm' | 'fatBurn' | 'cardio' | 'peak'

export type ZoneBand = { zone: ZoneName; fromBpm: number; toBpm: number | null }

function floorBeat(floor: number, maxHeartRate: number): number {
  return Math.round(Number((floor * maxHeartRate).toFixed(6)))
}

export function zoneBands(maxHeartRate: number): ZoneBand[] {
  const fatBurn = floorBeat(ZONE_FLOORS.fatBurn, maxHeartRate)
  const cardio = floorBeat(ZONE_FLOORS.cardio, maxHeartRate)
  const peak = floorBeat(ZONE_FLOORS.peak, maxHeartRate)

  return [
    { zone: 'warm', fromBpm: 0, toBpm: fatBurn - 1 },
    { zone: 'fatBurn', fromBpm: fatBurn, toBpm: cardio - 1 },
    { zone: 'cardio', fromBpm: cardio, toBpm: peak - 1 },
    { zone: 'peak', fromBpm: peak, toBpm: null },
  ]
}

export const AGE_FORMULA_BASE = 220

export function resolveMaxHeartRate(
  profile: Pick<ProfileInput, 'max_heart_rate' | 'birth_year'>,
  today: string,
): MaxHeartRate | null {
  if (profile.max_heart_rate !== null) {
    return { bpm: profile.max_heart_rate, source: 'override' }
  }

  if (profile.birth_year !== null) {
    const age = Number(today.slice(0, 4)) - profile.birth_year

    return { bpm: AGE_FORMULA_BASE - age, source: 'age' }
  }

  return null
}

const NO_ZONES: HeartRateZones = {
  warmSeconds: 0,
  fatBurnSeconds: 0,
  cardioSeconds: 0,
  peakSeconds: 0,
}

function shareBelow(beat: number, low: number, high: number): number {
  if (high <= low) {
    return beat > high ? 1 : 0
  }

  return Math.min(1, Math.max(0, (beat - low) / (high - low)))
}

export function heartRateZones(
  session: HeartRateSession,
  maxHeartRate: number | null,
): HeartRateZones {
  const seconds = Math.max(0, Math.trunc(session.gym_seconds ?? 0))
  const average = session.avg_heart_rate
  const peak = session.max_heart_rate

  if (seconds === 0 || average === null || peak === null || peak <= 0) {
    return { ...NO_ZONES }
  }

  const high = Math.max(average, peak)
  const low = Math.max(0, 2 * average - high)
  const reference = maxHeartRate ?? high

  const belowFatBurn = Math.round(seconds * shareBelow(ZONE_FLOORS.fatBurn * reference, low, high))
  const belowCardio = Math.round(seconds * shareBelow(ZONE_FLOORS.cardio * reference, low, high))
  const belowPeak = Math.round(seconds * shareBelow(ZONE_FLOORS.peak * reference, low, high))

  return {
    warmSeconds: belowFatBurn,
    fatBurnSeconds: belowCardio - belowFatBurn,
    cardioSeconds: belowPeak - belowCardio,
    peakSeconds: seconds - belowPeak,
  }
}
