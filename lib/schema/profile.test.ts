import { describe, expect, it } from 'vitest'

import { profileSchema, unitSystemSchema } from './profile'

import type { ProfileInput } from './profile'
import type { Tables } from '../supabase/database.types'

type ProfileRow = Tables<'profiles'>

type Assignable<A, B> = A extends B ? true : false

const keysExistOnRow: Assignable<keyof ProfileInput, keyof ProfileRow> = true

const inputAssignableToRow: Assignable<ProfileInput, Pick<ProfileRow, keyof ProfileInput>> = true

function parse(overrides: Record<string, unknown> = {}) {
  return profileSchema.safeParse({ ...overrides })
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

describe('unitSystemSchema', () => {
  it('accepts metric', () => {
    expect(unitSystemSchema.safeParse('metric').success).toBe(true)
  })

  it('accepts imperial', () => {
    expect(unitSystemSchema.safeParse('imperial').success).toBe(true)
  })

  it('rejects any other unit system', () => {
    expect(unitSystemSchema.safeParse('stones').success).toBe(false)
  })
})

describe('profileSchema', () => {
  it('falls back to the database defaults', () => {
    const result = parse()

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      display_name: null,
      unit_system: 'metric',
      height_cm: null,
      target_weight_kg: null,
      step_goal: 12000,
    })
  })

  it('trims the display name', () => {
    expect(parse({ display_name: '  Sumonta  ' }).data?.display_name).toBe('Sumonta')
  })

  it('accepts a display name of 80 characters', () => {
    expect(parse({ display_name: 'a'.repeat(80) }).success).toBe(true)
  })

  it('rejects a display name of 81 characters', () => {
    expect(parse({ display_name: 'a'.repeat(81) }).success).toBe(false)
  })

  it('rejects a height_cm below 50', () => {
    expect(parse({ height_cm: 49.9 }).success).toBe(false)
  })

  it('accepts a height_cm of 50', () => {
    expect(parse({ height_cm: 50 }).success).toBe(true)
  })

  it('accepts a height_cm of 260', () => {
    expect(parse({ height_cm: 260 }).success).toBe(true)
  })

  it('rejects a height_cm above 260', () => {
    expect(parse({ height_cm: 260.1 }).success).toBe(false)
  })

  it('rejects a height_cm with two decimals', () => {
    const issue = firstIssue(parse({ height_cm: 170.55 }))

    expect(issue.message).toBe('A height takes at most one decimal.')
    expect(issue.path).toEqual(['height_cm'])
  })

  it('rejects a target_weight_kg below 20', () => {
    expect(parse({ target_weight_kg: 19.99 }).success).toBe(false)
  })

  it('accepts a target_weight_kg of 20', () => {
    expect(parse({ target_weight_kg: 20 }).success).toBe(true)
  })

  it('accepts a target_weight_kg of 300', () => {
    expect(parse({ target_weight_kg: 300 }).success).toBe(true)
  })

  it('rejects a target_weight_kg above 300', () => {
    expect(parse({ target_weight_kg: 300.01 }).success).toBe(false)
  })

  it('rejects a target_weight_kg with three decimals', () => {
    expect(parse({ target_weight_kg: 78.125 }).success).toBe(false)
  })

  it('rejects a step_goal below 1', () => {
    expect(parse({ step_goal: 0 }).success).toBe(false)
  })

  it('accepts a step_goal of 1', () => {
    expect(parse({ step_goal: 1 }).success).toBe(true)
  })

  it('accepts a step_goal of 200000', () => {
    expect(parse({ step_goal: 200000 }).success).toBe(true)
  })

  it('rejects a step_goal above 200000', () => {
    expect(parse({ step_goal: 200001 }).success).toBe(false)
  })

  it('rejects a step_goal that is not whole', () => {
    expect(parse({ step_goal: 10500.5 }).success).toBe(false)
  })

  it('infers a type whose keys all exist on the generated profiles row', () => {
    expect(keysExistOnRow).toBe(true)
  })

  it('infers a type assignable to the generated profiles row', () => {
    expect(inputAssignableToRow).toBe(true)
  })
})
