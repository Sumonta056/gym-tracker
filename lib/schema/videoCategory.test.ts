import { describe, expect, it } from 'vitest'

import {
  CATEGORY_COLORS,
  categoryColorSchema,
  MAX_CATEGORY_NAME_LENGTH,
  nextCategoryColor,
  videoCategorySchema,
} from './videoCategory'

describe('videoCategorySchema', () => {
  it('trims a category name and refuses 41 characters', () => {
    expect(videoCategorySchema.parse({ name: '  Yoga  ', color: 'data-cyan' }).name).toBe('Yoga')
    expect(
      videoCategorySchema.safeParse({
        name: 'a'.repeat(MAX_CATEGORY_NAME_LENGTH),
        color: 'data-cyan',
      }).success,
    ).toBe(true)
    expect(
      videoCategorySchema.safeParse({
        name: 'a'.repeat(MAX_CATEGORY_NAME_LENGTH + 1),
        color: 'data-cyan',
      }).success,
    ).toBe(false)
  })

  it('refuses a blank name', () => {
    expect(videoCategorySchema.safeParse({ name: '   ', color: 'data-cyan' }).success).toBe(false)
  })

  it('refuses a color outside the 6 data tokens', () => {
    expect(videoCategorySchema.safeParse({ name: 'Yoga', color: 'accent' }).success).toBe(false)
    expect(categoryColorSchema.safeParse('data-red').success).toBe(false)
  })

  it('holds the 6 colors in the order of the spec', () => {
    expect(CATEGORY_COLORS).toEqual([
      'data-cyan',
      'data-violet',
      'data-pink',
      'data-blue',
      'data-yellow',
      'data-slate',
    ])
  })
})

describe('nextCategoryColor', () => {
  it('gives the first color when none is used', () => {
    expect(nextCategoryColor([])).toBe('data-cyan')
  })

  it('gives the first unused color in order', () => {
    expect(nextCategoryColor(['data-cyan', 'data-pink'])).toBe('data-violet')
  })

  it('starts again at the first color when all 6 are used', () => {
    expect(nextCategoryColor([...CATEGORY_COLORS])).toBe('data-cyan')
  })

  it('takes the least used color, first in order on a tie, past 6', () => {
    expect(nextCategoryColor([...CATEGORY_COLORS, 'data-cyan'])).toBe('data-violet')
  })
})
