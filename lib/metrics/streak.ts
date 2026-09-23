import { localDayNumber, toDayNumber } from './day'

export interface Streak {
  current: number
  longest: number
}

function sortedDayNumbers(dates: readonly string[]): number[] {
  const days = new Set<number>()

  for (const date of dates) {
    const day = toDayNumber(date)

    if (day !== null) {
      days.add(day)
    }
  }

  return [...days].sort((left, right) => left - right)
}

export function streak(dates: readonly string[], now: Date = new Date()): Streak {
  const today = localDayNumber(now)

  let previous: number | null = null
  let run = 0
  let longest = 0
  let runToDate = 0
  let lastPastDay: number | null = null

  for (const day of sortedDayNumbers(dates)) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1
    previous = day
    longest = Math.max(longest, run)

    if (day <= today) {
      runToDate = run
      lastPastDay = day
    }
  }

  const current = lastPastDay !== null && lastPastDay >= today - 1 ? runToDate : 0

  return { current, longest }
}
