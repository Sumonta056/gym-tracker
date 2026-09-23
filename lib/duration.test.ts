import { describe, expect, it } from 'vitest'

import { formatDuration, parseInput, parseSheetValue } from './duration'

const ACCEPTED: { input: string; seconds: number }[] = [
  { input: '1:12:05', seconds: 4325 },
  { input: '72:05', seconds: 4325 },
  { input: '72m', seconds: 4320 },
  { input: '1h 12m', seconds: 4320 },
  { input: '1h12m', seconds: 4320 },
  { input: '90', seconds: 5400 },
  { input: '1.5h', seconds: 5400 },
  { input: '45s', seconds: 45 },
  { input: '1h12m5s', seconds: 4325 },
  { input: '  1H 12M  ', seconds: 4320 },
  { input: '0', seconds: 0 },
  { input: '0:00', seconds: 0 },
  { input: '24h', seconds: 86400 },
  { input: '1.5m', seconds: 90 },
  { input: '2h', seconds: 7200 },
]

const EMPTY_REASON = 'Enter a duration.'
const SHAPE_REASON = 'Enter a duration such as 1:12:05, 72m or 1h 12m.'
const OVERFLOW_REASON = 'Minutes and seconds must be under 60.'
const NEGATIVE_REASON = 'A duration cannot be negative.'
const TOO_LONG_REASON = 'A duration cannot be longer than 24 hours.'

const REJECTED: { input: string; reason: string }[] = [
  { input: '', reason: EMPTY_REASON },
  { input: '   ', reason: EMPTY_REASON },
  { input: 'abc', reason: SHAPE_REASON },
  { input: 'about an hour', reason: SHAPE_REASON },
  { input: '5k', reason: SHAPE_REASON },
  { input: '12m1h', reason: SHAPE_REASON },
  { input: '5:', reason: SHAPE_REASON },
  { input: 'a:30', reason: SHAPE_REASON },
  { input: '1:2:3:4', reason: SHAPE_REASON },
  { input: '1:70:00', reason: OVERFLOW_REASON },
  { input: '12:75', reason: OVERFLOW_REASON },
  { input: '-5', reason: NEGATIVE_REASON },
  { input: '-1:00', reason: NEGATIVE_REASON },
  { input: '25h', reason: TOO_LONG_REASON },
  { input: '1500', reason: TOO_LONG_REASON },
]

type SheetCase = { name: string; input: string; seconds: number; certain: boolean }

const SHEET_RULES: SheetCase[] = [
  {
    name: 'three dot parts as hours, minutes and seconds',
    input: '1.15.37',
    seconds: 4537,
    certain: true,
  },
  { name: 'a colon form with three parts', input: '1:03:13', seconds: 3793, certain: true },
  {
    name: 'two dot parts with a second part of 60 or more as decimal minutes',
    input: '19.93',
    seconds: 1196,
    certain: true,
  },
  {
    name: 'two dot parts with a second part under 60 as minutes and seconds',
    input: '15.54',
    seconds: 954,
    certain: false,
  },
  { name: 'a bare number as whole minutes', input: '25', seconds: 1500, certain: true },
  { name: 'a colon form with two parts', input: '12:34', seconds: 754, certain: true },
  {
    name: 'a single trailing digit under 60 as minutes and seconds',
    input: '19.9',
    seconds: 1149,
    certain: false,
  },
]

const SHEET_BLANKS: string[] = ['0', '-', '', '   ', 'abc', 'a:b', '1:70:00', '1:2:3:4']

const WALK_ROWS: SheetCase[] = [
  { name: 'walk row 1', input: '15.54', seconds: 954, certain: false },
  { name: 'walk row 2', input: '28.24', seconds: 1704, certain: false },
  { name: 'walk row 4', input: '20.21', seconds: 1221, certain: false },
  { name: 'walk row 5', input: '19.93', seconds: 1196, certain: true },
  { name: 'walk row 6', input: '1.15.37', seconds: 4537, certain: true },
  { name: 'walk row 7', input: '1.23.00', seconds: 4980, certain: true },
  { name: 'walk row 9', input: '25', seconds: 1500, certain: true },
  { name: 'walk row 10', input: '51.03', seconds: 3063, certain: false },
  { name: 'walk row 11', input: '27.04', seconds: 1624, certain: false },
  { name: 'walk row 12', input: '36.45', seconds: 2205, certain: false },
  { name: 'walk row 13', input: '38.04', seconds: 2284, certain: false },
  { name: 'walk row 14', input: '02.37.00', seconds: 9420, certain: true },
  { name: 'walk row 15', input: '44.43', seconds: 2683, certain: false },
  { name: 'walk row 16', input: '55.24', seconds: 3324, certain: false },
]

const WALK_BLANK_ROWS: { name: string; input: string }[] = [
  { name: 'walk row 3', input: '0' },
  { name: 'walk row 8', input: '0' },
]

const GYM_ROWS: SheetCase[] = [
  { name: 'gym row 1', input: '1:03:13', seconds: 3793, certain: true },
  { name: 'gym row 2', input: '52.24', seconds: 3144, certain: false },
  { name: 'gym row 3', input: '01.44.50', seconds: 6290, certain: true },
  { name: 'gym row 4', input: '01.08.17', seconds: 4097, certain: true },
  { name: 'gym row 5', input: '01.00.14', seconds: 3614, certain: true },
  { name: 'gym row 6', input: '01.23.03', seconds: 4983, certain: true },
  { name: 'gym row 8', input: '35.09', seconds: 2109, certain: false },
  { name: 'gym row 9', input: '01.23.07', seconds: 4987, certain: true },
  { name: 'gym row 10', input: '01.01.59', seconds: 3719, certain: true },
  { name: 'gym row 11', input: '51.02', seconds: 3062, certain: false },
  { name: 'gym row 12', input: '01.03.19', seconds: 3799, certain: true },
  { name: 'gym row 13', input: '01.06.13', seconds: 3973, certain: true },
  { name: 'gym row 15', input: '01.19.53', seconds: 4793, certain: true },
  { name: 'gym row 16', input: '01.12.05', seconds: 4325, certain: true },
]

const GYM_BLANK_ROWS: { name: string; input: string }[] = [
  { name: 'gym row 7', input: '0' },
  { name: 'gym row 14', input: '-' },
]

const TWO_PART = /^(\d+)\.(\d+)$/

function mulberry32(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function secondsOf(text: string): number | null {
  const result = parseInput(text)
  return result.ok ? result.seconds : null
}

function reasonOf(text: string): string {
  const result = parseInput(text)
  return result.ok ? '' : result.reason
}

describe('parseInput', () => {
  it.each(ACCEPTED)('accepts $input as $seconds seconds', ({ input, seconds }) => {
    expect(parseInput(input)).toEqual({ ok: true, seconds })
  })

  it.each(ACCEPTED)('returns an integer number of seconds for $input', ({ input }) => {
    expect(Number.isInteger(secondsOf(input))).toBe(true)
  })

  it.each(REJECTED)('rejects "$input" with the reason $reason', ({ input, reason }) => {
    expect(parseInput(input)).toEqual({ ok: false, reason })
  })

  it('gives every rejection a non empty sentence ending in a full stop', () => {
    const reasons = REJECTED.map(({ input }) => reasonOf(input))

    expect(reasons).toHaveLength(REJECTED.length)

    for (const reason of reasons) {
      expect(reason.length).toBeGreaterThan(0)
      expect(reason.endsWith('.')).toBe(true)
      expect(reason.trim()).toBe(reason)
    }
  })
})

describe('parseSheetValue', () => {
  it.each(SHEET_RULES)('reads $name from $input', ({ input, seconds, certain }) => {
    expect(parseSheetValue(input)).toEqual({ seconds, certain })
  })

  it.each(SHEET_BLANKS.map((input) => ({ input })))('returns null for "$input"', ({ input }) => {
    expect(parseSheetValue(input)).toBeNull()
  })

  it.each(WALK_ROWS)(
    'reads the walk column $name as $seconds seconds',
    ({ input, seconds, certain }) => {
      expect(parseSheetValue(input)).toEqual({ seconds, certain })
    },
  )

  it.each(WALK_BLANK_ROWS)('returns null for the walk column $name', ({ input }) => {
    expect(parseSheetValue(input)).toBeNull()
  })

  it.each(GYM_ROWS)(
    'reads the gym column $name as $seconds seconds',
    ({ input, seconds, certain }) => {
      expect(parseSheetValue(input)).toEqual({ seconds, certain })
    },
  )

  it.each(GYM_BLANK_ROWS)('returns null for the gym column $name', ({ input }) => {
    expect(parseSheetValue(input)).toBeNull()
  })

  it('covers all sixteen walk rows and all sixteen gym rows', () => {
    expect(WALK_ROWS.length + WALK_BLANK_ROWS.length).toBe(16)
    expect(GYM_ROWS.length + GYM_BLANK_ROWS.length).toBe(16)
  })

  it('never claims certainty for an ambiguous minutes and seconds value', () => {
    const ambiguous = [...WALK_ROWS, ...GYM_ROWS].filter(({ input }) => {
      const match = TWO_PART.exec(input)
      return match !== null && Number(match[2]) < 60
    })

    expect(ambiguous.length).toBeGreaterThan(0)

    for (const { input } of ambiguous) {
      const result = parseSheetValue(input)

      expect(typeof result?.seconds).toBe('number')
      expect(result?.certain).toBe(false)
    }
  })
})

describe('formatDuration', () => {
  const clockCases: { seconds: number; text: string }[] = [
    { seconds: 4325, text: '1:12:05' },
    { seconds: 725, text: '12:05' },
    { seconds: 0, text: '0:00' },
    { seconds: 3600, text: '1:00:00' },
    { seconds: 59, text: '0:59' },
    { seconds: -30, text: '0:00' },
    { seconds: 59.6, text: '1:00' },
  ]

  const shortCases: { seconds: number; text: string }[] = [
    { seconds: 4325, text: '1h 12m' },
    { seconds: 2700, text: '45m' },
    { seconds: 0, text: '0m' },
    { seconds: 7200, text: '2h' },
    { seconds: -1, text: '0m' },
    { seconds: 86399, text: '23h 59m' },
  ]

  const minuteCases: { seconds: number; text: string }[] = [
    { seconds: 4325, text: '72m' },
    { seconds: 3707, text: '62m' },
    { seconds: 0, text: '0m' },
    { seconds: 29, text: '0m' },
    { seconds: 30, text: '1m' },
    { seconds: -90, text: '0m' },
    { seconds: 7200, text: '120m' },
  ]

  it.each(minuteCases)(
    'formats $seconds seconds in the minutes style as $text',
    ({ seconds, text }) => {
      expect(formatDuration(seconds, 'minutes')).toBe(text)
    },
  )

  it.each(clockCases)(
    'formats $seconds seconds in the clock style as $text',
    ({ seconds, text }) => {
      expect(formatDuration(seconds, 'clock')).toBe(text)
    },
  )

  it.each(shortCases)(
    'formats $seconds seconds in the short style as $text',
    ({ seconds, text }) => {
      expect(formatDuration(seconds, 'short')).toBe(text)
    },
  )
})

describe('the clock round trip', () => {
  it('parses back every one of two hundred formatted values', () => {
    const next = mulberry32(20260921)
    let checked = 0

    for (let index = 0; index < 200; index += 1) {
      const seconds = Math.floor(next() * 86400)

      expect(parseInput(formatDuration(seconds, 'clock'))).toEqual({ ok: true, seconds })

      checked += 1
    }

    expect(checked).toBe(200)
  })

  it('generates only values inside the supported range', () => {
    const next = mulberry32(20260921)

    for (let index = 0; index < 200; index += 1) {
      const seconds = Math.floor(next() * 86400)

      expect(seconds).toBeGreaterThanOrEqual(0)
      expect(seconds).toBeLessThanOrEqual(86399)
    }
  })
})
