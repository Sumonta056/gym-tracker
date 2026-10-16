import { afterEach, describe, expect, it, vi } from 'vitest'

import { maxBirthYear, profileSchema, unitSystemSchema } from './profile'

import type { ProfileInput } from './profile'
import type { Tables } from '../supabase/database.types'

type ProfileRow = Tables<'profiles'>

const EXERCISE_ID = '22222222-2222-4222-8222-222222222222'

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

afterEach(() => {
  vi.useRealTimers()
})

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
      rest_sound_muted: false,
      rest_seconds_by_exercise: {},
      calorie_goal: null,
      gym_goal_seconds: null,
      walk_goal_seconds: null,
      sessions_per_week_goal: null,
      birth_year: null,
      max_heart_rate: null,
      stats_layout: null,
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

  it('keeps a muted rest sound', () => {
    expect(parse({ rest_sound_muted: true }).data?.rest_sound_muted).toBe(true)
  })

  it('rejects a rest_sound_muted that is not a boolean', () => {
    const issue = firstIssue(parse({ rest_sound_muted: 'on' }))

    expect(issue.message).toBe('Muted is either true or false.')
    expect(issue.path).toEqual(['rest_sound_muted'])
  })

  it('keeps a rest length for an exercise', () => {
    const rest = { [EXERCISE_ID]: 90 }

    expect(parse({ rest_seconds_by_exercise: rest }).data?.rest_seconds_by_exercise).toEqual(rest)
  })

  it('accepts a rest length of 0 seconds', () => {
    expect(parse({ rest_seconds_by_exercise: { [EXERCISE_ID]: 0 } }).success).toBe(true)
  })

  it('accepts a rest length of 3600 seconds', () => {
    expect(parse({ rest_seconds_by_exercise: { [EXERCISE_ID]: 3600 } }).success).toBe(true)
  })

  it('rejects a rest length below 0 seconds', () => {
    const issue = firstIssue(parse({ rest_seconds_by_exercise: { [EXERCISE_ID]: -1 } }))

    expect(issue.message).toBe('A rest cannot be negative.')
    expect(issue.path).toEqual(['rest_seconds_by_exercise', EXERCISE_ID])
  })

  it('rejects a rest length above 3600 seconds', () => {
    const issue = firstIssue(parse({ rest_seconds_by_exercise: { [EXERCISE_ID]: 3601 } }))

    expect(issue.message).toBe('A rest cannot be longer than 3600 seconds.')
    expect(issue.path).toEqual(['rest_seconds_by_exercise', EXERCISE_ID])
  })

  it('rejects a rest length that is not whole seconds', () => {
    const issue = firstIssue(parse({ rest_seconds_by_exercise: { [EXERCISE_ID]: 90.5 } }))

    expect(issue.message).toBe('Enter a whole number of seconds.')
    expect(issue.path).toEqual(['rest_seconds_by_exercise', EXERCISE_ID])
  })

  it('rejects a rest length keyed by something other than an exercise id', () => {
    const issue = firstIssue(parse({ rest_seconds_by_exercise: { bench: 90 } }))

    expect(issue.message).toBe('A rest length belongs to an exercise id.')
    expect(issue.path).toEqual(['rest_seconds_by_exercise', 'bench'])
  })

  it('rejects rest lengths that are not an object', () => {
    const issue = firstIssue(parse({ rest_seconds_by_exercise: 90 }))

    expect(issue.message).toBe('Enter the rest lengths by exercise.')
    expect(issue.path).toEqual(['rest_seconds_by_exercise'])
  })

  it('infers a type whose keys all exist on the generated profiles row', () => {
    expect(keysExistOnRow).toBe(true)
  })

  it('infers a type assignable to the generated profiles row', () => {
    expect(inputAssignableToRow).toBe(true)
  })
})

describe('the goal fields', () => {
  it('defaults every new field to null', () => {
    expect(profileSchema.parse({})).toMatchObject({
      calorie_goal: null,
      gym_goal_seconds: null,
      walk_goal_seconds: null,
      sessions_per_week_goal: null,
      birth_year: null,
      max_heart_rate: null,
      stats_layout: null,
    })
  })

  it.each([
    ['calorie_goal', 1, 10000, 0, 10001],
    ['gym_goal_seconds', 60, 86400, 59, 86401],
    ['walk_goal_seconds', 60, 86400, 59, 86401],
    ['sessions_per_week_goal', 1, 14, 0, 15],
    ['max_heart_rate', 30, 230, 29, 231],
  ])('keeps %s inside its range', (field, low, high, below, above) => {
    expect(parse({ [field]: low }).success).toBe(true)
    expect(parse({ [field]: high }).success).toBe(true)
    expect(parse({ [field]: below }).success).toBe(false)
    expect(parse({ [field]: above }).success).toBe(false)
  })

  it('accepts a birth year from 1900 to 10 years ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 5))
    expect(parse({ birth_year: 1900 }).success).toBe(true)
    expect(parse({ birth_year: 2016 }).success).toBe(true)
  })

  it('refuses a birth year before 1900 or less than 10 years ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 5))
    expect(parse({ birth_year: 1899 }).success).toBe(false)
    expect(firstIssue(parse({ birth_year: 2017 })).message).toBe(
      'A birth year must be at least 10 years ago.',
    )
  })

  it('accepts a card layout as a list of ids and hidden flags', () => {
    expect(parse({ stats_layout: [{ id: 'weight', hidden: true }] }).success).toBe(true)
  })

  it('refuses a card layout that is not a list, or an item with no hidden flag or id', () => {
    expect(parse({ stats_layout: { weight: true } }).success).toBe(false)
    expect(parse({ stats_layout: [{ id: 'weight' }] }).success).toBe(false)
    expect(parse({ stats_layout: [{ id: '', hidden: false }] }).success).toBe(false)
  })
})

describe('maxBirthYear', () => {
  it('is the year of the date minus 10', () => {
    expect(maxBirthYear(new Date(2026, 0, 1))).toBe(2016)
  })
})
