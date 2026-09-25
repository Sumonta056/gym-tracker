import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dailyEntrySchema, isNotFuture, localDate } from './dailyEntry'

import type { DailyEntryInput } from './dailyEntry'
import type { Tables } from '../supabase/database.types'

type DailyEntryRow = Tables<'daily_entries'>

type Assignable<A, B> = A extends B ? true : false

const keysExistOnRow: Assignable<keyof DailyEntryInput, keyof DailyEntryRow> = true

const inputAssignableToRow: Assignable<
  DailyEntryInput,
  Pick<DailyEntryRow, keyof DailyEntryInput>
> = true

const TODAY = '2026-06-15'
const TOMORROW = '2026-06-16'
const NOON = new Date(2026, 5, 15, 12, 0, 0)

function parse(overrides: Record<string, unknown> = {}) {
  return dailyEntrySchema.safeParse({ entry_date: TODAY, ...overrides })
}

function firstIssue(result: ReturnType<typeof parse>) {
  if (result.success) {
    throw new Error('expected the parse to fail')
  }

  const [issue] = result.error.issues

  if (issue === undefined) {
    throw new Error('expected at least one issue')
  }

  return issue
}

describe('localDate', () => {
  it('reads the local calendar date from a clock', () => {
    expect(localDate(NOON)).toBe(TODAY)
  })

  it('pads a single digit month and day', () => {
    expect(localDate(new Date(2026, 0, 2, 12, 0, 0))).toBe('2026-01-02')
  })

  it('stays on the same day one minute before local midnight', () => {
    expect(localDate(new Date(2026, 5, 15, 23, 59, 0))).toBe(TODAY)
  })

  it('moves to the next day at local midnight', () => {
    expect(localDate(new Date(2026, 5, 16, 0, 0, 0))).toBe(TOMORROW)
  })
})

describe('isNotFuture', () => {
  it('accepts a date before the given day', () => {
    expect(isNotFuture('2026-06-14', TODAY)).toBe(true)
  })

  it('accepts the given day', () => {
    expect(isNotFuture(TODAY, TODAY)).toBe(true)
  })

  it('rejects a date after the given day', () => {
    expect(isNotFuture(TOMORROW, TODAY)).toBe(false)
  })

  it('falls back to the local calendar date of the system clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOON)

    expect(isNotFuture(TODAY)).toBe(true)
    expect(isNotFuture(TOMORROW)).toBe(false)

    vi.useRealTimers()
  })
})

describe('dailyEntrySchema', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOON)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fills every optional field with null', () => {
    const result = parse()

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      entry_date: TODAY,
      walk_seconds: null,
      gym_seconds: null,
      avg_heart_rate: null,
      max_heart_rate: null,
      weight_kg: null,
      calories_burnt: null,
      steps: null,
      note: null,
    })
  })

  it('keeps every value it is given', () => {
    const result = parse({
      walk_seconds: 1800,
      gym_seconds: 3600,
      avg_heart_rate: 120,
      max_heart_rate: 160,
      weight_kg: 82.55,
      calories_burnt: 640,
      steps: 12500,
      note: '  leg day  ',
    })

    expect(result.success).toBe(true)
    expect(result.data?.note).toBe('leg day')
    expect(result.data?.walk_seconds).toBe(1800)
  })

  it('accepts today as the entry date', () => {
    expect(parse({ entry_date: TODAY }).success).toBe(true)
  })

  it('rejects tomorrow as the entry date', () => {
    const issue = firstIssue(parse({ entry_date: TOMORROW }))

    expect(issue.message).toBe('A date cannot be in the future.')
    expect(issue.path).toEqual(['entry_date'])
  })

  it('accepts yesterday as the entry date', () => {
    expect(parse({ entry_date: '2026-06-14' }).success).toBe(true)
  })

  it('rejects an entry date that is not an ISO date', () => {
    expect(parse({ entry_date: '15/06/2026' }).success).toBe(false)
  })

  it('rejects an avg_heart_rate below 30', () => {
    expect(parse({ avg_heart_rate: 29 }).success).toBe(false)
  })

  it('accepts an avg_heart_rate of 30', () => {
    expect(parse({ avg_heart_rate: 30 }).success).toBe(true)
  })

  it('accepts an avg_heart_rate of 230', () => {
    expect(parse({ avg_heart_rate: 230, max_heart_rate: 230 }).success).toBe(true)
  })

  it('rejects an avg_heart_rate above 230', () => {
    expect(parse({ avg_heart_rate: 231 }).success).toBe(false)
  })

  it('rejects a max_heart_rate below 30', () => {
    expect(parse({ max_heart_rate: 29 }).success).toBe(false)
  })

  it('accepts a max_heart_rate of 30', () => {
    expect(parse({ max_heart_rate: 30 }).success).toBe(true)
  })

  it('accepts a max_heart_rate of 230', () => {
    expect(parse({ max_heart_rate: 230 }).success).toBe(true)
  })

  it('rejects a max_heart_rate above 230', () => {
    expect(parse({ max_heart_rate: 231 }).success).toBe(false)
  })

  it('rejects a heart rate that is not a whole number', () => {
    expect(parse({ avg_heart_rate: 120.5 }).success).toBe(false)
  })

  it('rejects a max_heart_rate below the avg_heart_rate', () => {
    const issue = firstIssue(parse({ avg_heart_rate: 150, max_heart_rate: 149 }))

    expect(issue.message).toBe('The peak heart rate cannot be below the average.')
    expect(issue.path).toEqual(['max_heart_rate'])
  })

  it('accepts a max_heart_rate equal to the avg_heart_rate', () => {
    expect(parse({ avg_heart_rate: 150, max_heart_rate: 150 }).success).toBe(true)
  })

  it('accepts an avg_heart_rate with no max_heart_rate', () => {
    expect(parse({ avg_heart_rate: 150 }).success).toBe(true)
  })

  it('accepts a max_heart_rate with no avg_heart_rate', () => {
    expect(parse({ max_heart_rate: 150 }).success).toBe(true)
  })

  it('accepts an entry with neither heart rate', () => {
    expect(parse({ avg_heart_rate: null, max_heart_rate: null }).success).toBe(true)
  })

  it('rejects a weight_kg below 20', () => {
    expect(parse({ weight_kg: 19.99 }).success).toBe(false)
  })

  it('accepts a weight_kg of 20', () => {
    expect(parse({ weight_kg: 20 }).success).toBe(true)
  })

  it('accepts a weight_kg of 300', () => {
    expect(parse({ weight_kg: 300 }).success).toBe(true)
  })

  it('rejects a weight_kg above 300', () => {
    expect(parse({ weight_kg: 300.01 }).success).toBe(false)
  })

  it('accepts a weight_kg with two decimals', () => {
    expect(parse({ weight_kg: 82.55 }).success).toBe(true)
  })

  it('rejects a weight_kg with three decimals', () => {
    const issue = firstIssue(parse({ weight_kg: 82.555 }))

    expect(issue.message).toBe('A weight takes at most two decimals.')
    expect(issue.path).toEqual(['weight_kg'])
  })

  it('rejects calories_burnt below 0', () => {
    expect(parse({ calories_burnt: -1 }).success).toBe(false)
  })

  it('accepts calories_burnt of 0', () => {
    expect(parse({ calories_burnt: 0 }).success).toBe(true)
  })

  it('accepts calories_burnt of 10000', () => {
    expect(parse({ calories_burnt: 10000 }).success).toBe(true)
  })

  it('rejects calories_burnt above 10000', () => {
    expect(parse({ calories_burnt: 10001 }).success).toBe(false)
  })

  it('rejects steps below 0', () => {
    expect(parse({ steps: -1 }).success).toBe(false)
  })

  it('accepts steps of 0', () => {
    expect(parse({ steps: 0 }).success).toBe(true)
  })

  it('accepts steps of 200000', () => {
    expect(parse({ steps: 200000 }).success).toBe(true)
  })

  it('rejects steps above 200000', () => {
    expect(parse({ steps: 200001 }).success).toBe(false)
  })

  it('rejects walk_seconds below 0', () => {
    expect(parse({ walk_seconds: -1 }).success).toBe(false)
  })

  it('accepts walk_seconds of 0', () => {
    expect(parse({ walk_seconds: 0 }).success).toBe(true)
  })

  it('rejects gym_seconds below 0', () => {
    expect(parse({ gym_seconds: -1 }).success).toBe(false)
  })

  it('accepts gym_seconds of 0', () => {
    expect(parse({ gym_seconds: 0 }).success).toBe(true)
  })

  it('rejects seconds that are not whole', () => {
    expect(parse({ gym_seconds: 90.5 }).success).toBe(false)
  })

  it('infers a type whose keys all exist on the generated daily_entries row', () => {
    expect(keysExistOnRow).toBe(true)
  })

  it('infers a type assignable to the generated daily_entries row', () => {
    expect(inputAssignableToRow).toBe(true)
  })
})
