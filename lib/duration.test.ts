import { describe, expect, it } from 'vitest'

import { formatCompact, formatDuration, parseDuration } from './duration'

describe('parseDuration', () => {
  it('returns null for an empty string', () => {
    expect(parseDuration('')).toBeNull()
  })

  it('returns null for whitespace only', () => {
    expect(parseDuration('   ')).toBeNull()
  })

  it('parses a full clock string of hours, minutes and seconds', () => {
    expect(parseDuration('1:12:05')).toBe(4325)
  })

  it('parses a clock string of minutes and seconds', () => {
    expect(parseDuration('12:05')).toBe(725)
  })

  it('allows a minute part above 59 in the leading position', () => {
    expect(parseDuration('90:00')).toBe(5400)
  })

  it('returns null when a trailing clock part is above 59', () => {
    expect(parseDuration('1:75:00')).toBeNull()
  })

  it('returns null for a clock string with four parts', () => {
    expect(parseDuration('1:2:3:4')).toBeNull()
  })

  it('returns null for a clock string with an empty part', () => {
    expect(parseDuration('5:')).toBeNull()
  })

  it('returns null for a clock string with a non numeric part', () => {
    expect(parseDuration('a:30')).toBeNull()
  })

  it('parses a minutes only unit string', () => {
    expect(parseDuration('72m')).toBe(4320)
  })

  it('parses hours and minutes separated by a space', () => {
    expect(parseDuration('1h 12m')).toBe(4320)
  })

  it('parses hours, minutes and seconds with no spaces', () => {
    expect(parseDuration('1h12m5s')).toBe(4325)
  })

  it('parses an hours only unit string', () => {
    expect(parseDuration('2h')).toBe(7200)
  })

  it('parses a seconds only unit string', () => {
    expect(parseDuration('45s')).toBe(45)
  })

  it('treats a bare number as minutes', () => {
    expect(parseDuration('45')).toBe(2700)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(parseDuration('  1H 12M  ')).toBe(4320)
  })

  it('returns null for units in the wrong order', () => {
    expect(parseDuration('12m1h')).toBeNull()
  })

  it('returns null for an unknown unit', () => {
    expect(parseDuration('5k')).toBeNull()
  })

  it('returns null for free text', () => {
    expect(parseDuration('about an hour')).toBeNull()
  })

  it('returns an integer number of seconds', () => {
    expect(Number.isInteger(parseDuration('1:12:05'))).toBe(true)
  })
})

describe('formatDuration', () => {
  it('formats a value under an hour as minutes and seconds', () => {
    expect(formatDuration(725)).toBe('12:05')
  })

  it('formats a value over an hour as hours, minutes and seconds', () => {
    expect(formatDuration(4325)).toBe('1:12:05')
  })

  it('formats zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('clamps a negative value to zero', () => {
    expect(formatDuration(-30)).toBe('0:00')
  })

  it('rounds a fractional second', () => {
    expect(formatDuration(59.6)).toBe('1:00')
  })

  it('round trips with parseDuration', () => {
    expect(parseDuration(formatDuration(4325))).toBe(4325)
  })
})

describe('formatCompact', () => {
  it('formats a value under an hour as minutes', () => {
    expect(formatCompact(2700)).toBe('45m')
  })

  it('formats a value over an hour as hours and minutes', () => {
    expect(formatCompact(4325)).toBe('1h 12m')
  })

  it('formats zero', () => {
    expect(formatCompact(0)).toBe('0m')
  })

  it('clamps a negative value to zero', () => {
    expect(formatCompact(-1)).toBe('0m')
  })

  it('round trips with parseDuration', () => {
    expect(parseDuration(formatCompact(2700))).toBe(2700)
  })
})
