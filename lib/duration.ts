const MINUTES_ONLY = /^\d+$/
const CLOCK_PART = /^\d{1,2}$/
const UNIT_FORM = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600

export function parseDuration(input: string): number | null {
  const text = input.toLowerCase().replaceAll(/\s/g, '')

  if (text.includes(':')) {
    return parseClock(text)
  }

  if (MINUTES_ONLY.test(text)) {
    return Number(text) * SECONDS_PER_MINUTE
  }

  return parseUnits(text)
}

export function formatDuration(totalSeconds: number): string {
  const safe = clamp(totalSeconds)
  const hours = Math.floor(safe / SECONDS_PER_HOUR)
  const minutes = Math.floor((safe % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const seconds = safe % SECONDS_PER_MINUTE

  if (hours === 0) {
    return `${String(minutes)}:${pad(seconds)}`
  }

  return `${String(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function formatCompact(totalSeconds: number): string {
  const safe = clamp(totalSeconds)
  const hours = Math.floor(safe / SECONDS_PER_HOUR)
  const minutes = Math.floor((safe % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)

  if (hours === 0) {
    return `${String(minutes)}m`
  }

  return `${String(hours)}h ${String(minutes)}m`
}

function parseClock(text: string): number | null {
  const parts = text.split(':')

  if (parts.length > 3) {
    return null
  }

  if (!parts.every((part) => CLOCK_PART.test(part))) {
    return null
  }

  const numbers = parts.map(Number)

  if (numbers.slice(1).some((value) => value > 59)) {
    return null
  }

  return numbers.reduce((total, value) => total * SECONDS_PER_MINUTE + value, 0)
}

function parseUnits(text: string): number | null {
  const match = UNIT_FORM.exec(text)

  if (match === null) {
    return null
  }

  const [, hours, minutes, seconds] = match

  if (hours === undefined && minutes === undefined && seconds === undefined) {
    return null
  }

  return (
    toNumber(hours) * SECONDS_PER_HOUR + toNumber(minutes) * SECONDS_PER_MINUTE + toNumber(seconds)
  )
}

function toNumber(part: string | undefined): number {
  return part === undefined ? 0 : Number(part)
}

function clamp(totalSeconds: number): number {
  return Math.max(0, Math.round(totalSeconds))
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}
