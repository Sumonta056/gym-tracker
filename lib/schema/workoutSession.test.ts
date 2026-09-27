import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  WORKOUT_SESSION_STATUSES,
  workoutSessionSchema,
  workoutSessionStatusSchema,
} from './workoutSession'

import type { WorkoutSessionInput } from './workoutSession'
import type { Tables } from '../supabase/database.types'

type WorkoutSessionRow = Tables<'workout_sessions'>

type Assignable<A, B> = A extends B ? true : false

const keysExistOnRow: Assignable<keyof WorkoutSessionInput, keyof WorkoutSessionRow> = true

const inputAssignableToRow: Assignable<
  WorkoutSessionInput,
  Pick<WorkoutSessionRow, keyof WorkoutSessionInput>
> = true

const TODAY = '2026-06-15'
const TOMORROW = '2026-06-16'
const NOON = new Date(2026, 5, 15, 12, 0, 0)
const STARTED = '2026-06-15T10:00:00.000Z'
const ENDED = '2026-06-15T11:05:00.000Z'

function parse(overrides: Record<string, unknown> = {}) {
  return workoutSessionSchema.safeParse({ entry_date: TODAY, started_at: STARTED, ...overrides })
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

describe('workoutSessionStatusSchema', () => {
  it('holds the two statuses of the server check', () => {
    expect(WORKOUT_SESSION_STATUSES).toEqual(['active', 'finished'])
  })

  it('accepts active', () => {
    expect(workoutSessionStatusSchema.safeParse('active').success).toBe(true)
  })

  it('accepts finished', () => {
    expect(workoutSessionStatusSchema.safeParse('finished').success).toBe(true)
  })

  it('rejects any other status', () => {
    expect(workoutSessionStatusSchema.safeParse('paused').success).toBe(false)
  })
})

describe('workoutSessionSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOON)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts a valid session and starts it as active with no end', () => {
    const result = parse()

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      entry_date: TODAY,
      started_at: STARTED,
      ended_at: null,
      status: 'active',
    })
  })

  it('accepts a finished session with an end time', () => {
    expect(parse({ status: 'finished', ended_at: ENDED }).success).toBe(true)
  })

  it('accepts a start time with a numeric offset', () => {
    expect(parse({ started_at: '2026-06-15T12:00:00+02:00' }).success).toBe(true)
  })

  it('rejects an entry date that is not an ISO date', () => {
    const issue = firstIssue(parse({ entry_date: '15/06/2026' }))

    expect(issue.message).toBe('Enter a date as YYYY-MM-DD.')
    expect(issue.path).toEqual(['entry_date'])
  })

  it('rejects tomorrow as the entry date', () => {
    const issue = firstIssue(parse({ entry_date: TOMORROW }))

    expect(issue.message).toBe('A date cannot be in the future.')
    expect(issue.path).toEqual(['entry_date'])
  })

  it('rejects a start time that is not an ISO timestamp', () => {
    const issue = firstIssue(parse({ started_at: '10:00' }))

    expect(issue.message).toBe('Enter a start time as an ISO timestamp.')
    expect(issue.path).toEqual(['started_at'])
  })

  it('rejects an end time that is not an ISO timestamp', () => {
    const issue = firstIssue(parse({ status: 'finished', ended_at: 'later' }))

    expect(issue.message).toBe('Enter an end time as an ISO timestamp.')
    expect(issue.path).toEqual(['ended_at'])
  })

  it('rejects an unknown status', () => {
    const issue = firstIssue(parse({ status: 'paused' }))

    expect(issue.message).toBe('A session is either active or finished.')
    expect(issue.path).toEqual(['status'])
  })

  it('rejects an end time before the start time', () => {
    const issue = firstIssue(parse({ status: 'finished', ended_at: '2026-06-15T09:59:59.000Z' }))

    expect(issue.message).toBe('A session cannot end before it starts.')
    expect(issue.path).toEqual(['ended_at'])
  })

  it('accepts an end time equal to the start time', () => {
    expect(parse({ status: 'finished', ended_at: STARTED }).success).toBe(true)
  })

  it('rejects a finished session with no end time', () => {
    const issue = firstIssue(parse({ status: 'finished' }))

    expect(issue.message).toBe('A finished session needs an end time.')
    expect(issue.path).toEqual(['ended_at'])
  })

  it('rejects an active session with an end time', () => {
    const issue = firstIssue(parse({ status: 'active', ended_at: ENDED }))

    expect(issue.message).toBe('An active session has no end time.')
    expect(issue.path).toEqual(['ended_at'])
  })

  it('infers a type whose keys all exist on the generated workout_sessions row', () => {
    expect(keysExistOnRow).toBe(true)
  })

  it('infers a type assignable to the generated workout_sessions row', () => {
    expect(inputAssignableToRow).toBe(true)
  })
})
