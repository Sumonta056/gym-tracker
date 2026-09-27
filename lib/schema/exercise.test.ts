import { describe, expect, it } from 'vitest'

import { exerciseSchema, MUSCLE_GROUPS, muscleGroupSchema } from './exercise'

import type { ExerciseInput } from './exercise'
import type { Tables } from '../supabase/database.types'

type ExerciseRow = Tables<'exercises'>

type Assignable<A, B> = A extends B ? true : false

const keysExistOnRow: Assignable<keyof ExerciseInput, keyof ExerciseRow> = true

const inputAssignableToRow: Assignable<ExerciseInput, Pick<ExerciseRow, keyof ExerciseInput>> = true

function parse(overrides: Record<string, unknown> = {}) {
  return exerciseSchema.safeParse({ name: 'Bench Press', muscle_group: 'chest', ...overrides })
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

describe('muscleGroupSchema', () => {
  it('holds the seven muscle groups of the server check', () => {
    expect(MUSCLE_GROUPS).toEqual(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio'])
  })

  it('accepts every muscle group', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(muscleGroupSchema.safeParse(group).success).toBe(true)
    }
  })

  it('rejects any other muscle group', () => {
    expect(muscleGroupSchema.safeParse('glutes').success).toBe(false)
  })
})

describe('exerciseSchema', () => {
  it('accepts a valid exercise and defaults is_archived to false', () => {
    const result = parse()

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      name: 'Bench Press',
      muscle_group: 'chest',
      is_archived: false,
    })
  })

  it('keeps an archived flag it is given', () => {
    expect(parse({ is_archived: true }).data?.is_archived).toBe(true)
  })

  it('trims the name', () => {
    expect(parse({ name: '  Bench Press  ' }).data?.name).toBe('Bench Press')
  })

  it('rejects an empty name', () => {
    const issue = firstIssue(parse({ name: '   ' }))

    expect(issue.message).toBe('Enter a name for the exercise.')
    expect(issue.path).toEqual(['name'])
  })

  it('accepts a name of 80 characters', () => {
    expect(parse({ name: 'a'.repeat(80) }).success).toBe(true)
  })

  it('rejects a name of 81 characters', () => {
    const issue = firstIssue(parse({ name: 'a'.repeat(81) }))

    expect(issue.message).toBe('A name cannot be longer than 80 characters.')
    expect(issue.path).toEqual(['name'])
  })

  it('rejects a missing name', () => {
    const issue = firstIssue(parse({ name: undefined }))

    expect(issue.message).toBe('Enter a name for the exercise.')
    expect(issue.path).toEqual(['name'])
  })

  it('rejects an unknown muscle group', () => {
    const issue = firstIssue(parse({ muscle_group: 'glutes' }))

    expect(issue.message).toBe('Pick a muscle group.')
    expect(issue.path).toEqual(['muscle_group'])
  })

  it('rejects an archived flag that is not a boolean', () => {
    const issue = firstIssue(parse({ is_archived: 'yes' }))

    expect(issue.message).toBe('Archived is either true or false.')
    expect(issue.path).toEqual(['is_archived'])
  })

  it('infers a type whose keys all exist on the generated exercises row', () => {
    expect(keysExistOnRow).toBe(true)
  })

  it('infers a type assignable to the generated exercises row', () => {
    expect(inputAssignableToRow).toBe(true)
  })
})
