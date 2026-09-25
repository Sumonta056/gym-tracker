import { z } from 'zod'

import { MAX_STEPS, MAX_WEIGHT_KG, MIN_WEIGHT_KG } from './dailyEntry'

export const MIN_HEIGHT_CM = 50
export const MAX_HEIGHT_CM = 260
export const MAX_DISPLAY_NAME_LENGTH = 80
export const DEFAULT_STEP_GOAL = 12000

export const unitSystemSchema = z.enum(['metric', 'imperial'])

export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .max(MAX_DISPLAY_NAME_LENGTH, {
      error: `A name cannot be longer than ${String(MAX_DISPLAY_NAME_LENGTH)} characters.`,
    })
    .nullable()
    .default(null),
  unit_system: unitSystemSchema.default('metric'),
  height_cm: z
    .number({ error: 'Enter a height in centimetres.' })
    .min(MIN_HEIGHT_CM, { error: `A height cannot be below ${String(MIN_HEIGHT_CM)} cm.` })
    .max(MAX_HEIGHT_CM, { error: `A height cannot be above ${String(MAX_HEIGHT_CM)} cm.` })
    .multipleOf(0.1, { error: 'A height takes at most one decimal.' })
    .nullable()
    .default(null),
  target_weight_kg: z
    .number({ error: 'Enter a weight in kilograms.' })
    .min(MIN_WEIGHT_KG, { error: `A weight cannot be below ${String(MIN_WEIGHT_KG)} kg.` })
    .max(MAX_WEIGHT_KG, { error: `A weight cannot be above ${String(MAX_WEIGHT_KG)} kg.` })
    .multipleOf(0.01, { error: 'A weight takes at most two decimals.' })
    .nullable()
    .default(null),
  step_goal: z
    .int({ error: 'Enter a whole number of steps.' })
    .min(1, { error: 'A step goal must be at least 1.' })
    .max(MAX_STEPS, { error: `A step goal cannot be above ${String(MAX_STEPS)}.` })
    .default(DEFAULT_STEP_GOAL),
})

export type UnitSystem = z.infer<typeof unitSystemSchema>

export type ProfileInput = z.infer<typeof profileSchema>

export type ProfileDraft = z.input<typeof profileSchema>
