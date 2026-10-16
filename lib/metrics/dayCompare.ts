import { roundTo2 } from './round'

export type Direction = 'up' | 'down' | 'same'

export type VersusAverage = {
  average: number
  delta: number
  direction: Direction
}

export type WeighInPoint = {
  date: string
  weightKg: number | null
}

export type WeighInChange = {
  deltaKg: number
  previousDate: string
}

export const MIN_EARLIER_DAYS = 2

export function goalPercent(value: number | null, goal: number | null): number | null {
  if (value === null || goal === null || goal <= 0) {
    return null
  }

  return Math.round((value / goal) * 100)
}

export function directionOf(delta: number): Direction {
  if (delta > 0) {
    return 'up'
  }

  return delta < 0 ? 'down' : 'same'
}

export function versusAverage(
  today: number | null,
  previous: readonly (number | null)[],
): VersusAverage | null {
  const present = previous.filter((value): value is number => value !== null)

  if (today === null || present.length < MIN_EARLIER_DAYS) {
    return null
  }

  const mean = present.reduce((total, value) => total + value, 0) / present.length
  const delta = roundTo2(today - mean)

  return { average: roundTo2(mean), delta, direction: directionOf(delta) }
}

export function sinceLastWeighIn(points: readonly WeighInPoint[]): WeighInChange | null {
  const weighed = points.filter(
    (point): point is { date: string; weightKg: number } => point.weightKg !== null,
  )
  const latest = weighed.at(-1)
  const previous = weighed.at(-2)

  if (latest === undefined || previous === undefined) {
    return null
  }

  return { deltaKg: roundTo2(latest.weightKg - previous.weightKg), previousDate: previous.date }
}
