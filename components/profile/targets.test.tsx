import { describe, expect, it } from 'vitest'

import { PROFILE } from '../../tests/fixtures/dashboard'

import { parseTarget, targetLabel, targetText } from './targets'

const SET = { ...PROFILE, target_weight_kg: 71, height_cm: 174, step_goal: 12000 }

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
