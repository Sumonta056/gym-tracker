import { describe, expect, it } from 'vitest'

import { profileSchema } from '../../lib/schema/profile'
import { PROFILE } from '../../tests/fixtures/dashboard'

import {
  durationLabel,
  GOAL_MIN_SECONDS,
  GOAL_TOO_SHORT,
  parseDurationTarget,
  parseTarget,
  targetLabel,
  targetText,
} from './targets'

const SET = { ...PROFILE, target_weight_kg: 71, height_cm: 174, step_goal: 12000 }

const GOALS = { ...PROFILE, calorie_goal: 800, sessions_per_week_goal: 4 }

function schemaMessage(
  field: 'calorie_goal' | 'sessions_per_week_goal' | 'gym_goal_seconds',
  value: number,
) {
  return profileSchema.shape[field].safeParse(value).error?.issues[0]?.message
}

describe('targetLabel', () => {
  it('names the weight unit the profile shows', () => {
    expect(targetLabel('target_weight_kg', 'metric')).toBe('Target weight (kg)')
    expect(targetLabel('target_weight_kg', 'imperial')).toBe('Target weight (lb)')
  })

  it('names the step goal and the height', () => {
    expect(targetLabel('step_goal', 'imperial')).toBe('Daily step goal')
    expect(targetLabel('height_cm', 'imperial')).toBe('Height (cm)')
  })
})

describe('targetText', () => {
  it('writes the target weight in kilograms for metric', () => {
    expect(targetText(SET, 'target_weight_kg', 'metric')).toBe('71.0')
  })

  it('writes the target weight in pounds for imperial', () => {
    expect(targetText(SET, 'target_weight_kg', 'imperial')).toBe('156.5')
  })

  it('writes the step goal and the height as stored', () => {
    expect(targetText(SET, 'step_goal', 'metric')).toBe('12000')
    expect(targetText(SET, 'height_cm', 'metric')).toBe('174')
  })

  it('leaves an unset target blank', () => {
    expect(targetText(PROFILE, 'target_weight_kg', 'metric')).toBe('')
    expect(targetText(PROFILE, 'height_cm', 'metric')).toBe('')
  })
})

describe('parseTarget', () => {
  it('stores a metric target weight as typed', () => {
    expect(parseTarget('target_weight_kg', '70.5', 'metric')).toEqual({
      ok: true,
      patch: { target_weight_kg: 70.5 },
    })
  })

  it('stores an imperial target weight in kilograms', () => {
    expect(parseTarget('target_weight_kg', '156.5', 'imperial')).toEqual({
      ok: true,
      patch: { target_weight_kg: 70.99 },
    })
  })

  it('clears the target weight when the field is blank', () => {
    expect(parseTarget('target_weight_kg', '  ', 'metric')).toEqual({
      ok: true,
      patch: { target_weight_kg: null },
    })
  })

  it('clears the height when the field is blank', () => {
    expect(parseTarget('height_cm', '', 'metric')).toEqual({
      ok: true,
      patch: { height_cm: null },
    })
  })

  it('stores a whole step goal', () => {
    expect(parseTarget('step_goal', '9000', 'metric')).toEqual({
      ok: true,
      patch: { step_goal: 9000 },
    })
  })

  it('refuses a blank step goal with the schema message', () => {
    expect(parseTarget('step_goal', '', 'metric')).toEqual({
      ok: false,
      message: 'Enter a whole number of steps.',
    })
  })

  it('refuses a weight that is not a number with the schema message', () => {
    expect(parseTarget('target_weight_kg', 'heavy', 'imperial')).toEqual({
      ok: false,
      message: 'Enter a weight in kilograms.',
    })
  })

  it('refuses a height outside the schema range', () => {
    expect(parseTarget('height_cm', '400', 'metric')).toEqual({
      ok: false,
      message: 'A height cannot be above 260 cm.',
    })
  })
})

describe('targetLabel for the goals', () => {
  it('names the calorie goal and the sessions per week goal', () => {
    expect(targetLabel('calorie_goal', 'metric')).toBe('Daily calorie goal (kcal)')
    expect(targetLabel('sessions_per_week_goal', 'metric')).toBe('Sessions per week goal')
  })
})

describe('durationLabel', () => {
  it('names the gym time goal and the walk time goal', () => {
    expect(durationLabel('gym_goal_seconds')).toBe('Daily gym time goal')
    expect(durationLabel('walk_goal_seconds')).toBe('Daily walk time goal')
  })
})

describe('targetText for the goals', () => {
  it('writes a stored calorie goal and sessions goal', () => {
    expect(targetText(GOALS, 'calorie_goal', 'metric')).toBe('800')
    expect(targetText(GOALS, 'sessions_per_week_goal', 'metric')).toBe('4')
  })

  it('leaves an unset goal blank', () => {
    expect(targetText(PROFILE, 'calorie_goal', 'metric')).toBe('')
  })
})

describe('parseTarget for the goals', () => {
  it('stores a whole calorie goal', () => {
    expect(parseTarget('calorie_goal', '800', 'metric')).toEqual({
      ok: true,
      patch: { calorie_goal: 800 },
    })
  })

  it('clears the calorie goal when the field is blank', () => {
    expect(parseTarget('calorie_goal', ' ', 'metric')).toEqual({
      ok: true,
      patch: { calorie_goal: null },
    })
  })

  it('refuses a calorie goal of 0 with the schema message', () => {
    expect(parseTarget('calorie_goal', '0', 'metric')).toEqual({
      ok: false,
      message: schemaMessage('calorie_goal', 0),
    })
  })

  it('refuses 15 sessions a week with the schema message', () => {
    expect(parseTarget('sessions_per_week_goal', '15', 'metric')).toEqual({
      ok: false,
      message: schemaMessage('sessions_per_week_goal', 15),
    })
  })
})

describe('parseDurationTarget', () => {
  it('stores a gym time goal in seconds', () => {
    expect(parseDurationTarget('gym_goal_seconds', 3600)).toEqual({
      ok: true,
      patch: { gym_goal_seconds: 3600 },
    })
  })

  it('stores no goal as null', () => {
    expect(parseDurationTarget('walk_goal_seconds', null)).toEqual({
      ok: true,
      patch: { walk_goal_seconds: null },
    })
  })

  it('refuses a goal under 1 minute with the picker message', () => {
    expect(parseDurationTarget('gym_goal_seconds', 30)).toEqual({
      ok: false,
      message: GOAL_TOO_SHORT,
    })
  })

  it('refuses a goal under 5 minutes with the picker message', () => {
    expect(parseDurationTarget('walk_goal_seconds', 240)).toEqual({
      ok: false,
      message: 'A time goal must be at least 5 minutes.',
    })
  })

  it('stores a goal of exactly 5 minutes', () => {
    expect(parseDurationTarget('gym_goal_seconds', GOAL_MIN_SECONDS)).toEqual({
      ok: true,
      patch: { gym_goal_seconds: 300 },
    })
  })

  it('refuses a goal over 24 hours with the schema message', () => {
    expect(parseDurationTarget('gym_goal_seconds', 86401)).toEqual({
      ok: false,
      message: schemaMessage('gym_goal_seconds', 86401),
    })
  })
})
