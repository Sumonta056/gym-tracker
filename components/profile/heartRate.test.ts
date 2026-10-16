import { describe, expect, it } from 'vitest'

import { MIN_BIRTH_YEAR } from '../../lib/schema/profile'
import { PROFILE } from '../../tests/fixtures/dashboard'

import {
  HEART_RATE_FIELDS,
  HEART_RATE_LABELS,
  heartRateText,
  maxSourceText,
  parseHeartRate,
} from './heartRate'

describe('HEART_RATE_FIELDS', () => {
  it('names a label for every field', () => {
    expect(HEART_RATE_FIELDS.map((field) => HEART_RATE_LABELS[field])).toEqual([
      'Birth year',
      'Max heart rate (bpm)',
    ])
  })
})

describe('heartRateText', () => {
  it('shows a stored birth year as text', () => {
    expect(heartRateText({ ...PROFILE, birth_year: 1996 }, 'birth_year')).toBe('1996')
  })

  it('shows an empty field for a null value', () => {
    expect(heartRateText({ ...PROFILE, max_heart_rate: null }, 'max_heart_rate')).toBe('')
  })

  it('shows an empty field for a profile with no heart rate field at all', () => {
    expect(heartRateText(PROFILE, 'birth_year')).toBe('')
  })
})

describe('parseHeartRate', () => {
  it('reads a birth year', () => {
    expect(parseHeartRate('birth_year', '1996')).toEqual({ ok: true, patch: { birth_year: 1996 } })
  })

  it('reads an empty max as a cleared override', () => {
    expect(parseHeartRate('max_heart_rate', '')).toEqual({
      ok: true,
      patch: { max_heart_rate: null },
    })
  })

  it('refuses a birth year before the schema range with the schema message', () => {
    expect(parseHeartRate('birth_year', '1850')).toEqual({
      ok: false,
      message: `A birth year cannot be before ${String(MIN_BIRTH_YEAR)}.`,
    })
  })

  it('refuses a max that is not a number', () => {
    expect(parseHeartRate('max_heart_rate', 'fast').ok).toBe(false)
  })
})

describe('maxSourceText', () => {
  it('asks for the birth year when the max is not known', () => {
    expect(maxSourceText(null)).toBe('Add your birth year to see your max.')
  })

  it('names a max from the age', () => {
    expect(maxSourceText({ bpm: 190, source: 'age' })).toBe('The zones use 190 bpm, from your age.')
  })

  it('names an override as the own value', () => {
    expect(maxSourceText({ bpm: 175, source: 'override' })).toBe(
      'The zones use 175 bpm, your own value.',
    )
  })
})
