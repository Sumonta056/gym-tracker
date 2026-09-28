import { toDayNumber } from './day'

export const GAP_BUCKET_CAP = 5

export interface GapBucket {
  days: number
  count: number
}

export interface SessionGaps {
  gaps: number[]
  histogram: GapBucket[]
}

function sortedDays(dates: readonly string[]): number[] {
  const days = new Set<number>()

  for (const date of dates) {
    const day = toDayNumber(date)

    if (day !== null) {
      days.add(day)
    }
  }

  return [...days].sort((left, right) => left - right)
}

function dayGaps(days: readonly number[]): number[] {
  const gaps: number[] = []

  days.reduce((previous, day) => {
    gaps.push(day - previous)
    return day
  })

  return gaps
}

export function sessionGaps(dates: readonly string[]): SessionGaps {
  const days = sortedDays(dates)
  const gaps = days.length < 2 ? [] : dayGaps(days)
  const histogram = Array.from({ length: GAP_BUCKET_CAP }, (_, index) => {
    const bucket = index + 1

    return {
      days: bucket,
      count: gaps.filter((gap) => Math.min(gap, GAP_BUCKET_CAP) === bucket).length,
    }
  })

  return { gaps, histogram }
}
