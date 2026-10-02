import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseSheet } from '../../lib/csv/import'

import {
  applyToSimilar,
  cellKey,
  cellText,
  dayLabel,
  errorText,
  hasError,
  rawShape,
  readYear,
  remaining,
  reviewTargets,
  rowDetail,
  rowTitle,
  similarTargets,
} from './reviewState'

import type { ParsedRow, SheetCell } from '../../lib/csv/import'

const SHEET = readFileSync(new URL('../../tests/fixtures/gym-sheet.csv', import.meta.url), 'utf8')
const HEADER = 'Day,Walk Time,Gym Time,Avg Heart Rate,Highest Rate,Weight,Calories Burnt,Steps'

function sheetOf(...lines: string[]) {
  return parseSheet([HEADER, ...lines].join('\n'), { year: 2026 })
}

function firstRow(...lines: string[]): ParsedRow {
  const row = sheetOf(...lines).rows[0]
  if (row === undefined) throw new Error('no row')
  return row
}

describe('readYear', () => {
  it('reads a four digit year', () => {
    expect(readYear(' 2025 ')).toBe(2025)
  })

  it('refuses text that is not a year', () => {
    expect(readYear('25')).toBeNull()
    expect(readYear('abcd')).toBeNull()
  })

  it('refuses a year outside 1900 to 2100', () => {
    expect(readYear('1899')).toBeNull()
    expect(readYear('2101')).toBeNull()
  })
})

describe('rawShape', () => {
  it('keeps the digits after the point and folds the minutes', () => {
    expect(rawShape('15.54')).toBe('n.dd')
    expect(rawShape('5.54')).toBe('n.dd')
    expect(rawShape('12.5')).toBe('n.d')
  })
})

describe('reviewTargets', () => {
  it('finds every review cell of the fixture sheet', () => {
    expect(reviewTargets(parseSheet(SHEET, { year: 2026 }))).toHaveLength(11)
  })

  it('leaves out a review cell on a row with an error', () => {
    const sheet = sheetOf('August 12,15.54,1:00:00,,,,,5.9k', 'August 13,15.54,,,,,,')
    expect(reviewTargets(sheet).map((target) => target.rowIndex)).toEqual([1])
  })
})

describe('remaining', () => {
  it('counts the targets with no pick', () => {
    const targets = reviewTargets(sheetOf('August 12,15.54,48.55,,,,,'))
    expect(remaining(targets, {})).toBe(2)
    expect(remaining(targets, { [cellKey(0, 'walk_seconds')]: 0 })).toBe(1)
  })
})

describe('similarTargets and applyToSimilar', () => {
  const sheet = sheetOf(
    'August 12,15.54,48.55,,,,,',
    'August 13,27.36,,,,,,',
    'August 14,12.5,,,,,,',
  )
  const targets = reviewTargets(sheet)
  const walk = targets.find((target) => target.key === cellKey(0, 'walk_seconds'))
  if (walk === undefined) throw new Error('no target')

  it('matches the same column and the same shape only', () => {
    expect(similarTargets(targets, walk).map((target) => target.key)).toEqual([
      cellKey(1, 'walk_seconds'),
    ])
  })

  it('sets the reading on the cell and every similar cell, and keeps other picks', () => {
    const picks = applyToSimilar({ [cellKey(2, 'walk_seconds')]: 0 }, targets, walk, 1)
    expect(picks).toEqual({
      [cellKey(0, 'walk_seconds')]: 1,
      [cellKey(1, 'walk_seconds')]: 1,
      [cellKey(2, 'walk_seconds')]: 0,
    })
  })
})

describe('dayLabel and rowTitle', () => {
  it('writes a short day', () => {
    expect(dayLabel('2026-08-05')).toBe('5 Aug')
  })

  it('names the row by its place and its date', () => {
    expect(rowTitle(firstRow('August 12,,,,,,,'), 0)).toBe('Row 1 · 12 Aug')
  })

  it('names a row with a blank date', () => {
    expect(rowTitle(firstRow(',20,,,,,,'), 2)).toBe('Row 3 · no date')
  })

  it('names a row with an unreadable date by its raw text', () => {
    expect(rowTitle(firstRow('Augst 12,20,,,,,,'), 0)).toBe('Row 1 · Augst 12')
  })
})

describe('cellText', () => {
  const review: SheetCell = {
    status: 'review',
    raw: '15.54',
    reason: '',
    readings: [
      { label: 'a', seconds: 954 },
      { label: 'b', seconds: 932 },
    ],
  }

  it('shows the raw text of a review cell with no pick', () => {
    expect(cellText('walk_seconds', review)).toBe('15.54')
  })

  it('shows the picked reading in minutes and seconds', () => {
    expect(cellText('walk_seconds', review, 1)).toBe('15m 32s')
  })

  it('shows the raw text of an error cell, or a dash when blank', () => {
    expect(cellText('steps', { status: 'error', raw: '5.9k', reason: '' })).toBe('5.9k')
    expect(cellText('steps', { status: 'error', raw: '', reason: '' })).toBe('—')
  })

  it('formats each kind of ok value', () => {
    expect(cellText('steps', { status: 'ok', raw: '', value: null })).toBe('—')
    expect(cellText('entry_date', { status: 'ok', raw: '', value: '2026-08-12' })).toBe('12 Aug')
    expect(cellText('gym_seconds', { status: 'ok', raw: '', value: 3761 })).toBe('1:02:41')
    expect(cellText('weight_kg', { status: 'ok', raw: '', value: 81.4 })).toBe('81.4 kg')
    expect(cellText('steps', { status: 'ok', raw: '', value: 11482 })).toBe('11,482')
  })
})

describe('rowDetail', () => {
  it('joins the heart rates, weight, calories and steps', () => {
    expect(rowDetail(firstRow('August 12,,,131,164,81.40,412,9874'))).toBe(
      'HR 131 / 164 · 81.4 kg · 412 kcal · 9,874 steps',
    )
  })

  it('writes a dash for one missing heart rate and skips the empty rest', () => {
    expect(rowDetail(firstRow('August 12,,,131,,,,'))).toBe('HR 131 / —')
    expect(rowDetail(firstRow('August 12,,,,,,,'))).toBe('')
  })
})

describe('hasError and errorText', () => {
  it('names each error cell and its reason', () => {
    const row = firstRow('August 12,,,,,,,5.9k')
    expect(hasError(row)).toBe(true)
    expect(errorText(row)).toEqual(['Steps "5.9k" could not be read. Enter a number.'])
  })

  it('names a blank cell that must hold a value', () => {
    expect(errorText(firstRow(',20,,,,,,'))).toEqual([
      'Day is blank. Enter a date such as August 12.',
    ])
  })

  it('finds no error on a clean row', () => {
    expect(hasError(firstRow('August 12,20,,,,,,'))).toBe(false)
  })
})
