import { toDayNumber } from './day'

export const DEFAULT_WINDOW_DAYS = 7

export interface SeriesPoint {
  date: string
  value: number | null
}

export interface AveragedPoint extends SeriesPoint {
  average: number | null
}

interface DatedPoint extends SeriesPoint {
  day: number
}

function datedPoints(points: readonly SeriesPoint[]): DatedPoint[] {
  const dated: DatedPoint[] = []

  for (const point of points) {
    const day = toDayNumber(point.date)

    if (day !== null) {
      dated.push({ ...point, day })
    }
  }

  return dated.sort((left, right) => left.day - right.day)
}

export function movingAverage(
  points: readonly SeriesPoint[],
  windowDays: number = DEFAULT_WINDOW_DAYS,
): AveragedPoint[] {
  const span = Math.max(1, Math.trunc(windowDays))
  const dated = datedPoints(points)

  return dated.map((point) => {
    const first = point.day - (span - 1)

    let sum = 0
    let count = 0

    for (const other of dated) {
      if (other.day >= first && other.day <= point.day && other.value !== null) {
        sum += other.value
        count += 1
      }
    }

    return { date: point.date, value: point.value, average: count === 0 ? null : sum / count }
  })
}
