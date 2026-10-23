import { z } from 'zod'

export const CATEGORY_COLORS = [
  'data-cyan',
  'data-violet',
  'data-pink',
  'data-blue',
  'data-yellow',
  'data-slate',
] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]

export const MAX_CATEGORY_NAME_LENGTH = 40

export const categoryColorSchema = z.enum(CATEGORY_COLORS, { error: 'Pick a category color.' })

export const videoCategorySchema = z.object({
  name: z
    .string({ error: 'Enter a name for the category.' })
    .trim()
    .min(1, { error: 'Enter a name for the category.' })
    .max(MAX_CATEGORY_NAME_LENGTH, {
      error: `A category name cannot be longer than ${String(MAX_CATEGORY_NAME_LENGTH)} characters.`,
    }),
  color: categoryColorSchema,
})

export type VideoCategoryInput = z.infer<typeof videoCategorySchema>

export function nextCategoryColor(used: readonly CategoryColor[]): CategoryColor {
  const uses = Object.fromEntries(CATEGORY_COLORS.map((color) => [color, 0])) as Record<
    CategoryColor,
    number
  >

  for (const color of used) {
    uses[color] += 1
  }

  return CATEGORY_COLORS.reduce((least, color) => (uses[color] < uses[least] ? color : least))
}
