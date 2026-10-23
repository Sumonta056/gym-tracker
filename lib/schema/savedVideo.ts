import { z } from 'zod'

export const MAX_URL_LENGTH = 2048

export const MAX_TITLE_LENGTH = 120

export const MAX_TAGS = 10

export const MAX_TAG_LENGTH = 30

export const PRIORITIES = ['high', 'normal', 'low'] as const

export type Priority = (typeof PRIORITIES)[number]

const WEB_LINK = /^https?:\/\/[^\s/?#]+/i

export const prioritySchema = z.enum(PRIORITIES, { error: 'Pick high, normal or low.' })

export const videoUrlSchema = z
  .string({ error: 'Paste a link to the video.' })
  .trim()
  .min(1, { error: 'Paste a link to the video.' })
  .max(MAX_URL_LENGTH, {
    error: `A link cannot be longer than ${String(MAX_URL_LENGTH)} characters.`,
  })
  .regex(WEB_LINK, { error: 'Enter a link that starts with http or https.' })

export const tagSchema = z
  .string({ error: 'A tag is a word.' })
  .overwrite((tag) => tag.trim().replace(/^#+/, '').trim().toLowerCase())
  .min(1, { error: 'A tag needs at least 1 letter after the #.' })
  .max(MAX_TAG_LENGTH, {
    error: `A tag cannot be longer than ${String(MAX_TAG_LENGTH)} characters.`,
  })

export const tagsSchema = z
  .array(tagSchema, { error: 'Tags are a list of words.' })
  .overwrite((tags) => [...new Set(tags)])
  .max(MAX_TAGS, { error: `A video takes at most ${String(MAX_TAGS)} tags.` })

export const savedVideoSchema = z.object({
  url: videoUrlSchema,
  title: z
    .string({ error: 'Enter a title for the video.' })
    .trim()
    .min(1, { error: 'Enter a title for the video.' })
    .max(MAX_TITLE_LENGTH, {
      error: `A title cannot be longer than ${String(MAX_TITLE_LENGTH)} characters.`,
    }),
  category_id: z.uuid({ error: 'Pick a category.' }),
  tags: tagsSchema.default([]),
  priority: prioritySchema.default('normal'),
})

export type SavedVideoInput = z.infer<typeof savedVideoSchema>

export type SavedVideoDraft = z.input<typeof savedVideoSchema>
