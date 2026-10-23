import { describe, expect, it } from 'vitest'

import {
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH,
  PRIORITIES,
  prioritySchema,
  savedVideoSchema,
  tagSchema,
  tagsSchema,
  videoUrlSchema,
} from './savedVideo'

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'

function draft(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://youtu.be/x',
    title: 'Hip mobility',
    category_id: CATEGORY_ID,
    ...overrides,
  }
}

describe('videoUrlSchema', () => {
  it('trims a pasted link', () => {
    expect(videoUrlSchema.parse('  https://youtu.be/x  ')).toBe('https://youtu.be/x')
  })

  it('takes an upper case scheme', () => {
    expect(videoUrlSchema.safeParse('HTTPS://youtu.be/x').success).toBe(true)
  })

  it('takes a plain http link', () => {
    expect(videoUrlSchema.safeParse('http://example.com/v').success).toBe(true)
  })

  it.each(['javascript:alert(1)', 'instagram://reel/x', 'www.youtube.com/x', 'ftp://a.b/c', ''])(
    'refuses %s',
    (url) => {
      expect(videoUrlSchema.safeParse(url).success).toBe(false)
    },
  )

  it('refuses a scheme with no host', () => {
    expect(videoUrlSchema.safeParse('https://').success).toBe(false)
  })

  it('refuses a link of 2049 characters', () => {
    const prefix = 'https://youtu.be/'
    const exact = prefix + 'x'.repeat(MAX_URL_LENGTH - prefix.length)

    expect(videoUrlSchema.safeParse(exact).success).toBe(true)
    expect(videoUrlSchema.safeParse(`${exact}x`).success).toBe(false)
  })

  it('gives a plain sentence as the error', () => {
    const result = videoUrlSchema.safeParse('www.youtube.com/x')

    expect(result.error?.issues[0]?.message).toBe('Enter a link that starts with http or https.')
  })
})

describe('savedVideoSchema', () => {
  it('refuses a title of 0 or 121 characters after trim', () => {
    expect(savedVideoSchema.safeParse(draft({ title: '   ' })).success).toBe(false)
    expect(
      savedVideoSchema.safeParse(draft({ title: ` ${'a'.repeat(MAX_TITLE_LENGTH + 1)} ` })).success,
    ).toBe(false)
    expect(
      savedVideoSchema.parse(draft({ title: ` ${'a'.repeat(MAX_TITLE_LENGTH)} ` })).title,
    ).toBe('a'.repeat(MAX_TITLE_LENGTH))
  })

  it('defaults priority to normal and tags to []', () => {
    expect(savedVideoSchema.parse(draft())).toEqual({
      url: 'https://youtu.be/x',
      title: 'Hip mobility',
      category_id: CATEGORY_ID,
      tags: [],
      priority: 'normal',
    })
  })

  it('refuses a priority outside high, normal and low', () => {
    expect(PRIORITIES).toEqual(['high', 'normal', 'low'])
    expect(prioritySchema.safeParse('urgent').success).toBe(false)
    expect(savedVideoSchema.safeParse(draft({ priority: 'urgent' })).success).toBe(false)
  })

  it('refuses a category id that is not a uuid', () => {
    expect(savedVideoSchema.safeParse(draft({ category_id: 'yoga' })).success).toBe(false)
  })
})

describe('tagSchema', () => {
  it('stores a tag lower case with no # and no spaces around it', () => {
    expect(tagSchema.parse('  #Yoga ')).toBe('yoga')
  })

  it('refuses a lone #', () => {
    expect(tagSchema.safeParse('#').success).toBe(false)
    expect(tagsSchema.safeParse(['#']).success).toBe(false)
  })

  it('refuses a tag of 31 characters', () => {
    expect(tagSchema.safeParse('a'.repeat(MAX_TAG_LENGTH)).success).toBe(true)
    expect(tagSchema.safeParse('a'.repeat(MAX_TAG_LENGTH + 1)).success).toBe(false)
  })
})

describe('tagsSchema', () => {
  it('stores #Yoga, yoga and " YOGA " as 1 tag yoga', () => {
    expect(tagsSchema.parse(['#Yoga', 'yoga', ' YOGA '])).toEqual(['yoga'])
  })

  it('takes 10 tags', () => {
    const ten = Array.from({ length: MAX_TAGS }, (_, index) => `tag${String(index)}`)

    expect(tagsSchema.parse(ten)).toEqual(ten)
  })

  it('refuses an 11th tag', () => {
    const eleven = Array.from({ length: MAX_TAGS + 1 }, (_, index) => `tag${String(index)}`)
    const result = tagsSchema.safeParse(eleven)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('A video takes at most 10 tags.')
  })

  it('counts the tags after it drops the repeats', () => {
    const ten = Array.from({ length: MAX_TAGS }, (_, index) => `tag${String(index)}`)

    expect(tagsSchema.parse([...ten, '#TAG0'])).toEqual(ten)
  })
})
