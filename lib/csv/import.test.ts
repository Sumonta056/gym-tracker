import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import * as repository from '../db/repository'

import { parseSheet, rowEntry } from './import'

import type { ParsedSheet, SheetCell, SheetField } from './import'

vi.mock('../db/repository', () => ({
  getDay: vi.fn(),
  listRange: vi.fn(),
  upsertDay: vi.fn(),
  softDeleteDay: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  setRestSeconds: vi.fn(),
  listExercises: vi.fn(),
  createExercise: vi.fn(),
  renameExercise: vi.fn(),
  archiveExercise: vi.fn(),
  restoreExercise: vi.fn(),
  getActiveSession: vi.fn(),
  startSession: vi.fn(),
  finishSession: vi.fn(),
  gymTimeOfferFor: vi.fn(),
  gymTimeOfferOn: vi.fn(),
  acceptGymTimeOffer: vi.fn(),
  discardSession: vi.fn(),
  addSet: vi.fn(),
  updateSet: vi.fn(),
  deleteSet: vi.fn(),
  restoreSet: vi.fn(),
  listSets: vi.fn(),
  listSessions: vi.fn(),
  listSetsInRange: vi.fn(),
  setsForExercises: vi.fn(),
  lastSetFor: vi.fn(),
  lastSetsFor: vi.fn(),
  clearAll: vi.fn(),
}))

const SHEET = readFileSync(new URL('../../tests/fixtures/gym-sheet.csv', import.meta.url), 'utf8')

const HEADER = 'Day,Walk Time,Gym Time,Avg Heart Rate,Highest Rate,Weight,Calories Burnt,Steps'

const YEAR = { year: 2025 }

const REVIEW = 'review'

type Expected = number | null | typeof REVIEW

const WALK: Expected[] = [
  REVIEW,
  REVIEW,
  null,
  REVIEW,
  1125,
  4368,
  5040,
  null,
  1440,
  REVIEW,
  1611,
  REVIEW,
  REVIEW,
  9060,
  REVIEW,
  REVIEW,
]

const GYM: Expected[] = [
  3761,
  REVIEW,
  6087,
  4064,
  3729,
  4896,
  null,
  REVIEW,
  5111,
  3838,
  REVIEW,
  3862,
  4120,
  null,
  4649,
  4312,
]

const EXPECTED_REVIEW: { row: number; field: SheetField; mmss: number; decimal: number }[] = [
  { row: 0, field: 'walk_seconds', mmss: 954, decimal: 932 },
  { row: 1, field: 'walk_seconds', mmss: 1656, decimal: 1642 },
  { row: 1, field: 'gym_seconds', mmss: 2935, decimal: 2913 },
  { row: 3, field: 'walk_seconds', mmss: 1278, decimal: 1271 },
  { row: 7, field: 'gym_seconds', mmss: 2172, decimal: 2167 },
  { row: 9, field: 'walk_seconds', mmss: 2947, decimal: 2944 },
  { row: 10, field: 'gym_seconds', mmss: 3016, decimal: 3010 },
  { row: 11, field: 'walk_seconds', mmss: 2262, decimal: 2245 },
  { row: 12, field: 'walk_seconds', mmss: 2355, decimal: 2349 },
  { row: 14, field: 'walk_seconds', mmss: 2618, decimal: 2603 },
  { row: 15, field: 'walk_seconds', mmss: 3199, decimal: 3191 },
]

const FIELDS: SheetField[] = [
  'entry_date',
  'walk_seconds',
  'gym_seconds',
  'avg_heart_rate',
  'max_heart_rate',
  'weight_kg',
  'calories_burnt',
  'steps',
]

function sheet(...rows: string[]): string {
  return [HEADER, ...rows].join('\n') + '\n'
}

function cellOf(parsed: ParsedSheet, row: number, field: SheetField): SheetCell {
  const found = parsed.rows[row]

  if (found === undefined) {
    throw new Error(`No row ${String(row)}`)
  }

  return found.cells[field]
}

function durations(parsed: ParsedSheet, field: SheetField): unknown[] {
  return parsed.rows.map((row) => {
    const cell = row.cells[field]

    if (cell.status === 'review') {
      return REVIEW
    }

    return cell.status === 'ok' ? cell.value : cell
  })
}

function reviewCells(parsed: ParsedSheet): { row: number; field: SheetField }[] {
  return parsed.rows.flatMap((row, index) =>
    FIELDS.filter((field) => row.cells[field].status === 'review').map((field) => ({
      row: index,
      field,
    })),
  )
}

describe('parseSheet', () => {
  it('parses the 16-row sheet to 16 rows', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(parsed.rows).toHaveLength(16)
    expect(parsed.issues).toEqual([])
  })

  it('numbers each row by its line in the file, after the header on line 1', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(parsed.rows.map((row) => row.line)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ])
  })

  it('marks exactly the review cells the step 1.4 rules predict', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(reviewCells(parsed)).toEqual(EXPECTED_REVIEW.map(({ row, field }) => ({ row, field })))
  })

  it('marks no cell of the sheet as an error', () => {
    const parsed = parseSheet(SHEET, YEAR)

    const errors = parsed.rows.flatMap((row) =>
      FIELDS.filter((field) => row.cells[field].status === 'error'),
    )

    expect(errors).toEqual([])
  })

  it('reads every certain walk value to its exact second count', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(durations(parsed, 'walk_seconds')).toEqual(WALK)
  })

  it('reads every certain gym value to its exact second count', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(durations(parsed, 'gym_seconds')).toEqual(GYM)
  })

  it('gives a review duration both readings, mm.ss first and decimal minutes second', () => {
    const parsed = parseSheet(SHEET, YEAR)

    const readings = EXPECTED_REVIEW.map(({ row, field }) => {
      const cell = cellOf(parsed, row, field)

      return cell.status === 'review' ? cell.readings.map((reading) => reading.seconds) : cell
    })

    expect(readings).toEqual(EXPECTED_REVIEW.map(({ mmss, decimal }) => [mmss, decimal]))
  })

  it('labels the two readings of 15.54 as 15m 54s (as mm.ss) and 15.54 min · 15m 32s', () => {
    const cell = cellOf(parseSheet(SHEET, YEAR), 0, 'walk_seconds')

    expect(cell).toEqual({
      status: 'review',
      raw: '15.54',
      reason: expect.any(String) as string,
      readings: [
        { label: '15m 54s (as mm.ss)', seconds: 954 },
        { label: '15.54 min · 15m 32s', seconds: 932 },
      ],
    })
  })

  it('labels the two readings of 48.55 as 48m 55s (as mm.ss) and 48.55 min · 48m 33s', () => {
    const cell = cellOf(parseSheet(SHEET, YEAR), 1, 'gym_seconds')

    expect(cell.status === 'review' && cell.readings.map((reading) => reading.label)).toEqual([
      '48m 55s (as mm.ss)',
      '48.55 min · 48m 33s',
    ])
  })

  it('gives every review cell a reason the user can read', () => {
    const parsed = parseSheet(SHEET, YEAR)

    for (const { row, field } of EXPECTED_REVIEW) {
      const cell = cellOf(parsed, row, field)

      expect(cell.status === 'review' && cell.reason.length > 0).toBe(true)
    }
  })

  it('maps every column of one row to its daily entry field', () => {
    const row = parseSheet(SHEET, YEAR).rows[4]

    expect(row?.cells).toEqual({
      entry_date: { status: 'ok', raw: 'August 18', value: '2025-08-18' },
      walk_seconds: { status: 'ok', raw: '18.75', value: 1125 },
      gym_seconds: { status: 'ok', raw: '01.02.09', value: 3729 },
      avg_heart_rate: { status: 'ok', raw: '133', value: 133 },
      max_heart_rate: { status: 'ok', raw: '166', value: 166 },
      weight_kg: { status: 'ok', raw: '80.80', value: 80.8 },
      calories_burnt: { status: 'ok', raw: '425', value: 425 },
      steps: { status: 'ok', raw: '11,482', value: 11482 },
    })
  })

  it('reads a blank, a 0 and a - duration as an ok cell with no value', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(cellOf(parsed, 7, 'walk_seconds')).toEqual({ status: 'ok', raw: '', value: null })
    expect(cellOf(parsed, 2, 'walk_seconds')).toEqual({ status: 'ok', raw: '0', value: null })
    expect(cellOf(parsed, 13, 'gym_seconds')).toEqual({ status: 'ok', raw: '-', value: null })
  })

  it('reads a blank number cell as an ok cell with no value', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(cellOf(parsed, 2, 'weight_kg')).toEqual({ status: 'ok', raw: '', value: null })
    expect(cellOf(parsed, 6, 'avg_heart_rate')).toEqual({ status: 'ok', raw: '', value: null })
    expect(cellOf(parsed, 13, 'calories_burnt')).toEqual({ status: 'ok', raw: '', value: null })
  })

  it('reads every date of the sheet with the given year', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(parsed.rows.map((row) => row.cells.entry_date)).toEqual(
      [
        ['August 12', '2025-08-12'],
        ['August 13', '2025-08-13'],
        ['August 15', '2025-08-15'],
        ['August 16', '2025-08-16'],
        ['August 18', '2025-08-18'],
        ['August 19', '2025-08-19'],
        ['August 21', '2025-08-21'],
        ['August 23', '2025-08-23'],
        ['August 25', '2025-08-25'],
        ['August 27', '2025-08-27'],
        ['August 29', '2025-08-29'],
        ['August 31', '2025-08-31'],
        ['September 2', '2025-09-02'],
        ['September 5', '2025-09-05'],
        ['September 9', '2025-09-09'],
        ['September 13', '2025-09-13'],
      ].map(([raw, value]) => ({ status: 'ok', raw, value })),
    )
  })

  it('puts a different year on the same dates when asked', () => {
    const parsed = parseSheet(SHEET, { year: 2024 })

    expect(cellOf(parsed, 0, 'entry_date')).toMatchObject({ status: 'ok', value: '2024-08-12' })
    expect(cellOf(parsed, 15, 'entry_date')).toMatchObject({ status: 'ok', value: '2024-09-13' })
  })

  it('accepts February 29 in a leap year', () => {
    const parsed = parseSheet(sheet('February 29,25,,,,,,'), { year: 2024 })

    expect(cellOf(parsed, 0, 'entry_date')).toEqual({
      status: 'ok',
      raw: 'February 29',
      value: '2024-02-29',
    })
  })

  it('marks February 29 an error in a year that is not a leap year', () => {
    const parsed = parseSheet(sheet('February 29,25,,,,,,'), { year: 2025 })

    expect(cellOf(parsed, 0, 'entry_date').status).toBe('error')
  })

  it('marks a date that does not exist an error', () => {
    const parsed = parseSheet(sheet('September 31,25,,,,,,'), YEAR)

    expect(cellOf(parsed, 0, 'entry_date').status).toBe('error')
  })

  it('marks a month name it does not know an error with a reason', () => {
    const cell = cellOf(parseSheet(sheet('Smarch 3,25,,,,,,'), YEAR), 0, 'entry_date')

    expect(cell.status === 'error' && cell.reason.length > 0).toBe(true)
  })

  it('marks a blank date an error', () => {
    const parsed = parseSheet(sheet(',25,,,,,,'), YEAR)

    expect(cellOf(parsed, 0, 'entry_date').status).toBe('error')
  })

  it('reads a quoted field without its quotes', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(cellOf(parsed, 11, 'gym_seconds')).toEqual({
      status: 'ok',
      raw: '01.04.22',
      value: 3862,
    })
  })

  it('keeps a comma inside quotes in one field and does not shift the columns', () => {
    const parsed = parseSheet(SHEET, YEAR)

    expect(cellOf(parsed, 8, 'steps')).toEqual({ status: 'ok', raw: '9,306', value: 9306 })
    expect(cellOf(parsed, 14, 'steps')).toEqual({ status: 'ok', raw: '12,051', value: 12051 })
    expect(parsed.issues).toEqual([])
  })

  it('reads a doubled quote inside a quoted field as one quote', () => {
    const parsed = parseSheet(`${HEADER},Notes\nAugust 12,25,,,,,,,"leg day, ""heavy"""\n`, YEAR)

    expect(parsed.rows).toHaveLength(1)
    expect(cellOf(parsed, 0, 'walk_seconds')).toMatchObject({ status: 'ok', value: 1500 })
    expect(parsed.issues).toEqual([
      expect.objectContaining({ kind: 'extra_column', column: 'Notes' }),
    ])
  })

  it('reads a sheet with Windows line endings the same as one with plain line endings', () => {
    const crlf = SHEET.replaceAll('\n', '\r\n')

    expect(parseSheet(crlf, YEAR)).toEqual(parseSheet(SHEET, YEAR))
  })

  it('reads a sheet that starts with a byte order mark', () => {
    const parsed = parseSheet(`﻿${SHEET}`, YEAR)

    expect(parsed.issues).toEqual([])
    expect(parsed.rows).toHaveLength(16)
  })

  it('reads a sheet with no newline after the last row', () => {
    const parsed = parseSheet(SHEET.trimEnd(), YEAR)

    expect(parsed.rows).toHaveLength(16)
    expect(parsed.issues).toEqual([])
  })

  it('marks a sheet value of 60 or more after the dot as certain decimal minutes', () => {
    const parsed = parseSheet(sheet('August 12,19.93,,,,,,'), YEAR)

    expect(cellOf(parsed, 0, 'walk_seconds')).toEqual({
      status: 'ok',
      raw: '19.93',
      value: 1196,
    })
  })

  it('marks a duration it cannot read an error, not an empty value', () => {
    const cell = cellOf(parseSheet(sheet('August 12,about an hour,,,,,,'), YEAR), 0, 'walk_seconds')

    expect(cell.status === 'error' && cell.reason.length > 0).toBe(true)
  })

  it('marks a colon duration with 60 or more minutes an error', () => {
    const parsed = parseSheet(sheet('August 12,,1:70:00,,,,,'), YEAR)

    expect(cellOf(parsed, 0, 'gym_seconds').status).toBe('error')
  })

  it('marks a number cell that is not a number an error', () => {
    const cell = cellOf(parseSheet(sheet('August 12,25,,,,heavy,,'), YEAR), 0, 'weight_kg')

    expect(cell.status === 'error' && cell.reason.length > 0).toBe(true)
  })

  it('gives a weight above the bound an error carrying the schema message', () => {
    const parsed = parseSheet(sheet('August 12,25,,,,400,,'), YEAR)

    expect(cellOf(parsed, 0, 'weight_kg')).toEqual({
      status: 'error',
      raw: '400',
      reason: 'A weight cannot be above 300 kg.',
    })
  })

  it('gives a weight with three decimals an error carrying the schema message', () => {
    const parsed = parseSheet(sheet('August 12,25,,,,80.125,,'), YEAR)

    expect(cellOf(parsed, 0, 'weight_kg')).toMatchObject({
      status: 'error',
      reason: 'A weight takes at most two decimals.',
    })
  })

  it('gives a heart rate with a fraction an error carrying the schema message', () => {
    const parsed = parseSheet(sheet('August 12,25,,128.5,,,,'), YEAR)

    expect(cellOf(parsed, 0, 'avg_heart_rate')).toMatchObject({
      status: 'error',
      reason: 'Enter a whole heart rate.',
    })
  })

  it('gives a peak heart rate below the average an error on the peak cell', () => {
    const parsed = parseSheet(sheet('August 12,25,,150,140,,,'), YEAR)

    expect(cellOf(parsed, 0, 'max_heart_rate')).toEqual({
      status: 'error',
      raw: '140',
      reason: 'The peak heart rate cannot be below the average.',
    })
    expect(cellOf(parsed, 0, 'avg_heart_rate')).toEqual({ status: 'ok', raw: '150', value: 150 })
  })

  it('gives steps above the bound an error carrying the schema message', () => {
    const parsed = parseSheet(sheet('August 12,25,,,,,,"250,000"'), YEAR)

    expect(cellOf(parsed, 0, 'steps')).toMatchObject({
      status: 'error',
      reason: 'Steps cannot be above 200000.',
    })
  })

  it('gives negative calories an error carrying the schema message', () => {
    const parsed = parseSheet(sheet('August 12,25,,,,,-20,'), YEAR)

    expect(cellOf(parsed, 0, 'calories_burnt')).toMatchObject({
      status: 'error',
      reason: 'Calories cannot be negative.',
    })
  })

  it('gives a date in the future an error carrying the schema message', () => {
    const parsed = parseSheet(sheet('August 12,25,,,,,,'), { year: 2999 })

    expect(cellOf(parsed, 0, 'entry_date')).toEqual({
      status: 'error',
      raw: 'August 12',
      reason: 'A date cannot be in the future.',
    })
  })

  it('still checks the other cells of a row that holds a review cell', () => {
    const parsed = parseSheet(sheet('August 12,15.54,,,,400,,'), YEAR)

    expect(cellOf(parsed, 0, 'walk_seconds').status).toBe('review')
    expect(cellOf(parsed, 0, 'weight_kg')).toMatchObject({
      status: 'error',
      reason: 'A weight cannot be above 300 kg.',
    })
  })

  it('leaves the good cells of a row ok when another cell is an error', () => {
    const parsed = parseSheet(sheet('August 12,25,,,,400,310,'), YEAR)

    expect(cellOf(parsed, 0, 'walk_seconds')).toEqual({ status: 'ok', raw: '25', value: 1500 })
    expect(cellOf(parsed, 0, 'calories_burnt')).toEqual({ status: 'ok', raw: '310', value: 310 })
  })

  it('reports a missing column and does not throw', () => {
    const header = HEADER.replace(',Steps', '')
    const text = `${header}\nAugust 12,25,1:02:41,131,164,81.40,412\n`

    const parsed = parseSheet(text, YEAR)

    expect(parsed.issues).toEqual([
      expect.objectContaining({ kind: 'missing_column', column: 'Steps', line: 1 }),
    ])
    expect(parsed.rows).toHaveLength(1)
  })

  it('reports an extra column and still reads the known columns', () => {
    const text = `${HEADER},Mood\nAugust 12,25,1:02:41,131,164,81.40,412,9874,good\n`

    const parsed = parseSheet(text, YEAR)

    expect(parsed.issues).toEqual([
      expect.objectContaining({ kind: 'extra_column', column: 'Mood', line: 1 }),
    ])
    expect(cellOf(parsed, 0, 'steps')).toEqual({ status: 'ok', raw: '9874', value: 9874 })
  })

  it('reports a blank row by its line and does not count it as a row', () => {
    const text = sheet('August 12,25,,,,,,', '', 'August 13,30,,,,,,')

    const parsed = parseSheet(text, YEAR)

    expect(parsed.issues).toEqual([expect.objectContaining({ kind: 'blank_row', line: 3 })])
    expect(parsed.rows.map((row) => row.line)).toEqual([2, 4])
  })

  it('reports a row of empty cells as a blank row', () => {
    const text = sheet('August 12,25,,,,,,', ',,,,,,,')

    const parsed = parseSheet(text, YEAR)

    expect(parsed.issues).toEqual([expect.objectContaining({ kind: 'blank_row', line: 3 })])
    expect(parsed.rows).toHaveLength(1)
  })

  it('gives every sheet issue a message the user can read', () => {
    const text = `${HEADER.replace(',Steps', '')},Mood\nAugust 12,25,,,,,,good\n\nAugust 13,30,,,,,,fine\n`

    const parsed = parseSheet(text, YEAR)

    expect(parsed.issues.map((issue) => issue.kind).sort()).toEqual([
      'blank_row',
      'extra_column',
      'missing_column',
    ])
    expect(parsed.issues.every((issue) => issue.message.length > 0)).toBe(true)
  })

  it('reports all 8 columns missing for an empty file', () => {
    const parsed = parseSheet('', YEAR)

    expect(parsed.rows).toEqual([])
    expect(
      parsed.issues.filter((issue) => issue.kind === 'missing_column').map((i) => i.column),
    ).toEqual([
      'Day',
      'Walk Time',
      'Gym Time',
      'Avg Heart Rate',
      'Highest Rate',
      'Weight',
      'Calories Burnt',
      'Steps',
    ])
  })

  it('reports a short data row by its line and reads its missing cells as blank', () => {
    const parsed = parseSheet(sheet('August 12,25,1:02:41', 'August 13,30,,,,,,'), YEAR)

    expect(parsed.issues).toEqual([
      expect.objectContaining({ kind: 'short_row', line: 2, column: null }),
    ])
    expect(parsed.rows).toHaveLength(2)
    expect(cellOf(parsed, 0, 'gym_seconds')).toEqual({ status: 'ok', raw: '1:02:41', value: 3761 })
    expect(cellOf(parsed, 0, 'steps')).toEqual({ status: 'ok', raw: '', value: null })
  })

  it('reports a long data row by its line and ignores the cells past the header', () => {
    const parsed = parseSheet(sheet('August 12,25,,,,,,9874,extra,more'), YEAR)

    expect(parsed.issues).toEqual([
      expect.objectContaining({ kind: 'long_row', line: 2, column: null }),
    ])
    expect(cellOf(parsed, 0, 'steps')).toEqual({ status: 'ok', raw: '9874', value: 9874 })
  })

  it('reports an unclosed quote by the line it opens on', () => {
    const text = `${HEADER}\nAugust 12,25,,,,,,9874\nAugust 13,"30,,,,,,\nAugust 14,20,,,,,,\n`

    const parsed = parseSheet(text, YEAR)

    expect(parsed.issues).toContainEqual(
      expect.objectContaining({ kind: 'unclosed_quote', line: 3, column: null }),
    )
    expect(parsed.rows[0]?.line).toBe(2)
  })

  it('gives the short row, long row and unclosed quote issues a message that names the line', () => {
    const short = parseSheet(sheet('August 12,25'), YEAR).issues
    const long = parseSheet(sheet('August 12,25,,,,,,,,'), YEAR).issues
    const quote = parseSheet(`${HEADER}\nAugust 12,"25\n`, YEAR).issues

    for (const issue of [...short, ...long, ...quote]) {
      expect(issue.message).toMatch(/Line \d+/)
    }
    expect([...short, ...long, ...quote].map((issue) => issue.kind)).toEqual([
      'short_row',
      'long_row',
      'unclosed_quote',
    ])
  })

  it('reports no row issue for the 16-row sheet', () => {
    expect(parseSheet(SHEET, YEAR).issues).toEqual([])
  })

  it('returns no rows and no issues for a header with no rows', () => {
    expect(parseSheet(`${HEADER}\n`, YEAR)).toEqual({ rows: [], issues: [] })
  })

  it.each([
    ['an unclosed quote', `${HEADER}\nAugust 12,"25,,,,,,\n`],
    ['a row with too few cells', `${HEADER}\nAugust 12,25\n`],
    ['a row with too many cells', `${HEADER}\nAugust 12,25,,,,,,,,,\n`],
    ['a header only of commas', ',,,,,,,\nAugust 12,25,,,,,,\n'],
    ['text that is not a sheet', '\u0000\u0001 not a sheet �'],
    ['a lone quote', '"'],
    ['only newlines', '\n\n\n'],
  ])('never throws on %s', (_name, text) => {
    expect(() => parseSheet(text, YEAR)).not.toThrow()
  })

  it('writes nothing and never calls the repository', () => {
    parseSheet(SHEET, YEAR)
    parseSheet(sheet('August 12,25,,,,400,,', ''), YEAR)

    const called = Object.entries(repository)
      .filter(([, value]) => vi.isMockFunction(value) && value.mock.calls.length > 0)
      .map(([name]) => name)

    expect(Object.values(repository).filter((value) => vi.isMockFunction(value))).not.toEqual([])
    expect(called).toEqual([])
  })
})

describe('rowEntry', () => {
  function firstRow(text: string) {
    const row = parseSheet(text, YEAR).rows[0]

    if (row === undefined) {
      throw new Error('No row')
    }

    return row
  }

  it('turns an ok row into a daily entry draft with every sheet field', () => {
    const row = firstRow(sheet('August 12,1:02:41,1:02:41,131,164,81.40,412,"11,482"'))

    expect(rowEntry(row, {})).toEqual({
      entry_date: '2025-08-12',
      walk_seconds: 3761,
      gym_seconds: 3761,
      avg_heart_rate: 131,
      max_heart_rate: 164,
      weight_kg: 81.4,
      calories_burnt: 412,
      steps: 11482,
    })
  })

  it('reads a blank cell as null', () => {
    const row = firstRow(sheet('August 12,,,,,,,'))

    expect(rowEntry(row, {})).toMatchObject({ walk_seconds: null, steps: null, weight_kg: null })
  })

  it('takes the seconds of the picked reading of a review cell', () => {
    const row = firstRow(sheet('August 12,15.54,,,,,,'))

    expect(rowEntry(row, { walk_seconds: 0 })?.walk_seconds).toBe(954)
    expect(rowEntry(row, { walk_seconds: 1 })?.walk_seconds).toBe(932)
  })

  it('returns null while a review cell has no pick', () => {
    const row = firstRow(sheet('August 12,15.54,,,,,,'))

    expect(rowEntry(row, {})).toBeNull()
    expect(rowEntry(row, { walk_seconds: 2 })).toBeNull()
  })

  it('returns null for a row with an error', () => {
    const row = firstRow(sheet('August 12,25,,,,,,5.9k'))

    expect(rowEntry(row, {})).toBeNull()
  })
})
