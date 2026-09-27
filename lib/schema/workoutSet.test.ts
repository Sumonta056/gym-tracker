import { describe, expect, it } from 'vitest'

import { workoutSetSchema } from './workoutSet'

import type { WorkoutSetInput } from './workoutSet'
import type { Tables } from '../supabase/database.types'

type WorkoutSetRow = Tables<'workout_sets'>

type Assignable<A, B> = A extends B ? true : false

const keysExistOnRow: Assignable<keyof WorkoutSetInput, keyof WorkoutSetRow> = true

const inputAssignableToRow: Assignable<
  WorkoutSetInput,
  Pick<WorkoutSetRow, keyof WorkoutSetInput>
> = true

const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const EXERCISE_ID = '22222222-2222-4222-8222-222222222222'

function parse(overrides: Record<string, unknown> = {}) {
  return workoutSetSchema.safeParse({
    session_id: SESSION_ID,
    exercise_id: EXERCISE_ID,
    set_index: 0,
    reps: 8,
    ...overrides,
  })
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

describe('workoutSetSchema', () => {
  it('accepts a valid set and fills the optional fields with null', () => {
    const result = parse()

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      session_id: SESSION_ID,
      exercise_id: EXERCISE_ID,
      set_index: 0,
      reps: 8,
      weight_kg: null,
      rpe: null,
      completed_at: null,
    })
  })

  it('keeps every value it is given', () => {
    const result = parse({
      weight_kg: 82.5,
      rpe: 8,
      completed_at: '2026-06-15T10:12:00.000Z',
    })

    expect(result.success).toBe(true)
    expect(result.data?.weight_kg).toBe(82.5)
    expect(result.data?.rpe).toBe(8)
  })

  it('rejects a session_id that is not a UUID', () => {
    const issue = firstIssue(parse({ session_id: 'session-1' }))

    expect(issue.message).toBe('A set needs the id of its session.')
    expect(issue.path).toEqual(['session_id'])
  })

  it('rejects an exercise_id that is not a UUID', () => {
    const issue = firstIssue(parse({ exercise_id: 'bench' }))

    expect(issue.message).toBe('A set needs the id of its exercise.')
    expect(issue.path).toEqual(['exercise_id'])
  })

  it('rejects a set_index below 0', () => {
    const issue = firstIssue(parse({ set_index: -1 }))

    expect(issue.message).toBe('A set position cannot be negative.')
    expect(issue.path).toEqual(['set_index'])
  })

  it('rejects a set_index that is not whole', () => {
    const issue = firstIssue(parse({ set_index: 1.5 }))

    expect(issue.message).toBe('Enter a whole set position.')
    expect(issue.path).toEqual(['set_index'])
  })

  it('rejects reps of 0', () => {
    const issue = firstIssue(parse({ reps: 0 }))

    expect(issue.message).toBe('A set needs at least 1 rep.')
    expect(issue.path).toEqual(['reps'])
  })

  it('accepts reps of 1', () => {
    expect(parse({ reps: 1 }).success).toBe(true)
  })

  it('accepts reps of 1000', () => {
    expect(parse({ reps: 1000 }).success).toBe(true)
  })

  it('rejects reps above 1000', () => {
    const issue = firstIssue(parse({ reps: 1001 }))

    expect(issue.message).toBe('Reps cannot be above 1000.')
    expect(issue.path).toEqual(['reps'])
  })

  it('rejects reps that are not whole', () => {
    const issue = firstIssue(parse({ reps: 8.5 }))

    expect(issue.message).toBe('Enter a whole number of reps.')
    expect(issue.path).toEqual(['reps'])
  })

  it('rejects missing reps', () => {
    const issue = firstIssue(parse({ reps: null }))

    expect(issue.message).toBe('Enter a whole number of reps.')
    expect(issue.path).toEqual(['reps'])
  })

  it('accepts a weight_kg of 0', () => {
    expect(parse({ weight_kg: 0 }).success).toBe(true)
  })

  it('rejects a weight_kg below 0', () => {
    const issue = firstIssue(parse({ weight_kg: -0.5 }))

    expect(issue.message).toBe('A load cannot be negative.')
    expect(issue.path).toEqual(['weight_kg'])
  })

  it('accepts a weight_kg of 500', () => {
    expect(parse({ weight_kg: 500 }).success).toBe(true)
  })

  it('rejects a weight_kg above 500', () => {
    const issue = firstIssue(parse({ weight_kg: 500.01 }))

    expect(issue.message).toBe('A load cannot be above 500 kg.')
    expect(issue.path).toEqual(['weight_kg'])
  })

  it('accepts a weight_kg with two decimals', () => {
    expect(parse({ weight_kg: 22.75 }).success).toBe(true)
  })

  it('rejects a weight_kg with three decimals', () => {
    const issue = firstIssue(parse({ weight_kg: 22.755 }))

    expect(issue.message).toBe('A load takes at most two decimals.')
    expect(issue.path).toEqual(['weight_kg'])
  })

  it('rejects a weight_kg that is not a number', () => {
    const issue = firstIssue(parse({ weight_kg: '80' }))

    expect(issue.message).toBe('Enter a load in kilograms.')
    expect(issue.path).toEqual(['weight_kg'])
  })

  it('accepts a null rpe', () => {
    expect(parse({ rpe: null }).success).toBe(true)
  })

  it('rejects an rpe below 1', () => {
    const issue = firstIssue(parse({ rpe: 0 }))

    expect(issue.message).toBe('An RPE cannot be below 1.')
    expect(issue.path).toEqual(['rpe'])
  })

  it('accepts an rpe of 1', () => {
    expect(parse({ rpe: 1 }).success).toBe(true)
  })

  it('accepts an rpe of 10', () => {
    expect(parse({ rpe: 10 }).success).toBe(true)
  })

  it('rejects an rpe above 10', () => {
    const issue = firstIssue(parse({ rpe: 11 }))

    expect(issue.message).toBe('An RPE cannot be above 10.')
    expect(issue.path).toEqual(['rpe'])
  })

  it('rejects an rpe that is not whole', () => {
    const issue = firstIssue(parse({ rpe: 7.5 }))

    expect(issue.message).toBe('Enter a whole RPE.')
    expect(issue.path).toEqual(['rpe'])
  })

  it('rejects a completed_at that is not an ISO timestamp', () => {
    const issue = firstIssue(parse({ completed_at: 'now' }))

    expect(issue.message).toBe('Enter a completion time as an ISO timestamp.')
    expect(issue.path).toEqual(['completed_at'])
  })

  it('infers a type whose keys all exist on the generated workout_sets row', () => {
    expect(keysExistOnRow).toBe(true)
  })

  it('infers a type assignable to the generated workout_sets row', () => {
    expect(inputAssignableToRow).toBe(true)
  })
})
