import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseSheet } from '../../lib/csv/import'

import {
  applyToSimilar,
  cellKey,
  chooseForAll,
  duplicateDates,
  importPlan,
  repeatedRows,
  repeatText,
  rowDate,
  rowPicks,
  sharedChoice,
  spokenRowTitle,
  undecided,
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

const SHEET = readFileSync(join(process.cwd(), 'tests/fixtures/gym-sheet.csv'), 'utf8')
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

describe('rowDate', () => {
  it('returns the ISO date of a row, or null when the date is an error', () => {
    const sheet = sheetOf('August 12,20,,,,,,', 'Augustus 13,20,,,,,,')
    expect(sheet.rows.map(rowDate)).toEqual(['2026-08-12', null])
  })
})

describe('repeatedRows', () => {
  it('maps a later row with the same date to the first row of that date', () => {
    const sheet = sheetOf('August 12,20,,,,,,', 'August 13,20,,,,,,', 'August 12,30,,,,,,')
    expect(repeatedRows(sheet)).toEqual(new Map([[2, 0]]))
  })

  it('ignores a row with an error', () => {
    const sheet = sheetOf('August 12,20,,,,,,5.9k', 'August 12,20,,,,,,')
    expect(repeatedRows(sheet)).toEqual(new Map())
  })

  it('asks no pick on a repeated row', () => {
    const sheet = sheetOf('August 12,20,,,,,,', 'August 12,15.54,,,,,,')
    expect(reviewTargets(sheet)).toEqual([])
  })
})

describe('repeatText', () => {
  it('names the date and the earlier row', () => {
    const sheet = sheetOf('August 12,20,,,,,,', 'August 12,30,,,,,,')
    expect(repeatText(sheet, 1, 0)).toBe(
      'Day 12 Aug is also on row 1, so only that row is imported.',
    )
  })

  it('falls back to a plain word for a row it cannot find', () => {
    const sheet = sheetOf('August 12,20,,,,,,')
    expect(repeatText(sheet, 5, 0)).toBe(
      'This date is also on row 1, so only that row is imported.',
    )
  })
})

describe('rowPicks', () => {
  it('takes the picks of one row by field', () => {
    const picks = { [cellKey(1, 'walk_seconds')]: 1, [cellKey(2, 'gym_seconds')]: 0 }
    expect(rowPicks(picks, 1)).toEqual({ walk_seconds: 1 })
    expect(rowPicks(picks, 2)).toEqual({ gym_seconds: 0 })
  })
})

describe('the logged dates', () => {
  const sheet = sheetOf(
    'August 12,20,,,,,,',
    'August 13,20,,,,,,',
    'August 13,20,,,,,,',
    'August 14,20,,,,,,5.9k',
  )
  const logged = new Set(['2026-08-13', '2026-08-14'])

  it('lists the importable rows whose date is logged, once each', () => {
    expect(duplicateDates(sheet, logged)).toEqual(['2026-08-13'])
  })

  it('counts the dates with no choice yet', () => {
    expect(undecided(['2026-08-13', '2026-08-15'], { '2026-08-13': 'skip' })).toBe(1)
  })

  it('sets one choice on every date', () => {
    expect(chooseForAll(['a', 'b'], 'merge')).toEqual({ a: 'merge', b: 'merge' })
  })

  it('names the shared choice, or null when the dates differ or have none', () => {
    expect(sharedChoice(['a', 'b'], { a: 'skip', b: 'skip' })).toBe('skip')
    expect(sharedChoice(['a', 'b'], { a: 'skip', b: 'merge' })).toBeNull()
    expect(sharedChoice(['a'], {})).toBeNull()
    expect(sharedChoice([], {})).toBeNull()
  })
})

describe('importPlan', () => {
  const sheet = sheetOf(
    'August 11,20,,,,,,',
    'August 12,20,,,,,,',
    'August 13,20,,,,,,',
    'August 14,20,,,,,,',
    'August 15,20,,,,,,5.9k',
    'August 11,20,,,,,,',
    'August 16,15.54,,,,,,',
  )
  const logged = new Set(['2026-08-12', '2026-08-13', '2026-08-14'])

  it('counts new, overwritten, merged, skipped and left out rows', () => {
    const plan = importPlan(sheet, { [cellKey(6, 'walk_seconds')]: 0 }, logged, {
      '2026-08-12': 'overwrite',
      '2026-08-13': 'merge',
      '2026-08-14': 'skip',
    })
    expect(plan.counts).toEqual({ created: 2, overwritten: 1, merged: 1, skipped: 1, leftOut: 2 })
    expect(plan.writes).toBe(4)
    expect(plan.days.map((day) => [day.entry.entry_date, day.choice])).toEqual([
      ['2026-08-11', undefined],
      ['2026-08-12', 'overwrite'],
      ['2026-08-13', 'merge'],
      ['2026-08-14', 'skip'],
      ['2026-08-16', undefined],
    ])
    expect(plan.days[4]?.entry.walk_seconds).toBe(954)
  })

  it('leaves out a logged date with no choice and a row with an unpicked reading', () => {
    const plan = importPlan(sheet, {}, logged, {})
    expect(plan.counts).toEqual({ created: 1, overwritten: 0, merged: 0, skipped: 0, leftOut: 6 })
  })
})

describe('spokenRowTitle', () => {
  it('names the row and the full date, as a screen reader reads it', () => {
    const sheet = sheetOf('September 13,20,,,,,,', 'Augustus 13,20,,,,,,')
    expect(sheet.rows.map((row, index) => spokenRowTitle(row, index))).toEqual([
      'Row 1, 13 September',
      'Row 2',
    ])
  })
})
