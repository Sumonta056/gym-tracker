const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const MAX_SECONDS = 86400

const DIGITS = /^\d+$/
const DECIMAL = /^\d+(?:\.\d+)?$/
const UNITS = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/
const SHEET_THREE_PARTS = /^\d+\.\d+\.\d+$/
const SHEET_TWO_PARTS = /^\d+\.\d+$/

const EMPTY_REASON = 'Enter a duration.'
const SHAPE_REASON = 'Enter a duration such as 1:12:05, 72m or 1h 12m.'
const OVERFLOW_REASON = 'Minutes and seconds must be under 60.'
const NEGATIVE_REASON = 'A duration cannot be negative.'
const TOO_LONG_REASON = 'A duration cannot be longer than 24 hours.'

export type ParsedInput = { ok: true; seconds: number } | { ok: false; reason: string }

export type ParsedSheetValue = { seconds: number; certain: boolean }

export type DurationStyle = 'clock' | 'short' | 'minutes'

export function parseInput(text: string): ParsedInput {
  const compact = text.toLowerCase().replaceAll(/\s+/g, '')

  if (compact === '') {
    return fail(EMPTY_REASON)
  }

  if (compact.startsWith('-')) {
    return fail(NEGATIVE_REASON)
  }

  const parsed = compact.includes(':') ? readClock(compact) : readPlain(compact)

  if (!parsed.ok) {
    return parsed
  }

  if (parsed.seconds > MAX_SECONDS) {
    return fail(TOO_LONG_REASON)
  }

  return parsed
}

export function parseSheetValue(text: string): ParsedSheetValue | null {
  const compact = text.trim()

  if (compact === '' || compact === '-') {
    return null
  }

  if (compact.includes(':')) {
    const clock = readClock(compact)

    if (!clock.ok) {
      return null
    }

    return settle(clock.seconds, true)
  }

  if (SHEET_THREE_PARTS.test(compact)) {
    return settle(readDotParts(compact), true)
  }

  if (SHEET_TWO_PARTS.test(compact)) {
    const trailing = Number(compact.slice(compact.indexOf('.') + 1))

    if (trailing >= SECONDS_PER_MINUTE) {
      return settle(Math.round(Number(compact) * SECONDS_PER_MINUTE), true)
    }

    return settle(readDotParts(compact), false)
  }

  if (DIGITS.test(compact)) {
    return settle(Number(compact) * SECONDS_PER_MINUTE, true)
  }

  return null
}

export function formatDuration(seconds: number, style: DurationStyle): string {
  const safe = Math.max(0, Math.round(seconds))

  if (style === 'minutes') {
    return `${String(Math.round(safe / SECONDS_PER_MINUTE))}m`
  }

  const hours = Math.floor(safe / SECONDS_PER_HOUR)
  const minutes = Math.floor((safe % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)

  if (style === 'short') {
    if (hours === 0) {
      return `${String(minutes)}m`
    }

    if (minutes === 0) {
      return `${String(hours)}h`
    }

    return `${String(hours)}h ${String(minutes)}m`
  }

  const rest = safe % SECONDS_PER_MINUTE

  if (hours === 0) {
    return `${String(minutes)}:${pad(rest)}`
  }

  return `${String(hours)}:${pad(minutes)}:${pad(rest)}`
}

function readClock(compact: string): ParsedInput {
  const parts = compact.split(':')

  if (parts.length > 3) {
    return fail(SHAPE_REASON)
  }

  if (!parts.every((part) => DIGITS.test(part))) {
    return fail(SHAPE_REASON)
  }

  const numbers = parts.map(Number)

  if (numbers.slice(1).some((value) => value >= SECONDS_PER_MINUTE)) {
    return fail(OVERFLOW_REASON)
  }

  return { ok: true, seconds: numbers.reduce(stepUp, 0) }
}

function readPlain(compact: string): ParsedInput {
  if (DECIMAL.test(compact)) {
    return { ok: true, seconds: Math.round(Number(compact) * SECONDS_PER_MINUTE) }
  }

  const match = UNITS.exec(compact)

  if (match === null) {
    return fail(SHAPE_REASON)
  }

  const [, hours, minutes, seconds] = match

  return {
    ok: true,
    seconds: Math.round(
      toNumber(hours) * SECONDS_PER_HOUR +
        toNumber(minutes) * SECONDS_PER_MINUTE +
        toNumber(seconds),
    ),
  }
}

function readDotParts(compact: string): number {
  return compact.split('.').map(Number).reduce(stepUp, 0)
}

function stepUp(total: number, value: number): number {
  return total * SECONDS_PER_MINUTE + value
}

function settle(seconds: number, certain: boolean): ParsedSheetValue | null {
  return seconds === 0 ? null : { seconds, certain }
}

function fail(reason: string): ParsedInput {
  return { ok: false, reason }
}

function toNumber(part: string | undefined): number {
  return part === undefined ? 0 : Number(part)
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}
