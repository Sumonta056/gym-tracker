import { toDayNumber } from '../metrics/day'

const MS_PER_DAY = 86400000

export const LOG_PATH = '/log'

export function parseLogDate(value: string | null, today: string): string {
  if (value === null || toDayNumber(value) === null || value > today) {
    return today
  }

  return value
}

export function shiftLogDate(date: string, days: number): string {
  const day = toDayNumber(date) ?? 0

  return new Date((day + days) * MS_PER_DAY).toISOString().slice(0, 10)
}

export function logPath(date: string): string {
  return `${LOG_PATH}?date=${date}`
}

export function dayPath(date: string, today: string): string {
  return date === today ? '/' : `/?date=${date}`
}

export function localNoon(date: string): Date {
  const at = new Date((toDayNumber(date) ?? 0) * MS_PER_DAY)

  return new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), 12)
}
