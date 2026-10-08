import { z } from 'zod'

import { MAX_DURATION_SECONDS } from '../duration'

import {
  MAX_CALORIES_BURNT,
  MAX_HEART_RATE,
  MAX_STEPS,
  MAX_WEIGHT_KG,
  MIN_HEART_RATE,
  MIN_WEIGHT_KG,
} from './dailyEntry'

export const MIN_HEIGHT_CM = 50
export const MAX_HEIGHT_CM = 260
export const MAX_DISPLAY_NAME_LENGTH = 80
export const DEFAULT_STEP_GOAL = 12000
export const MAX_REST_SECONDS = 3600
export const MIN_GOAL_SECONDS = 60
export const MAX_SESSIONS_PER_WEEK = 14
export const MIN_BIRTH_YEAR = 1900
export const MIN_AGE_YEARS = 10
export const MAX_STATS_CARDS = 40
export const MAX_STATS_CARD_ID_LENGTH = 40

export function maxBirthYear(now: Date = new Date()): number {
  return now.getFullYear() - MIN_AGE_YEARS
}

const goalSeconds = z
  .int({ error: 'Enter a whole number of seconds.' })
  .min(MIN_GOAL_SECONDS, { error: 'A time goal must be at least 1 minute.' })
  .max(MAX_DURATION_SECONDS, { error: 'A time goal cannot be longer than 24 hours.' })
  .nullable()
  .default(null)

export const statsLayoutItemSchema = z.object({
  id: z.string().min(1).max(MAX_STATS_CARD_ID_LENGTH),
  hidden: z.boolean(),
})

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
  rest_sound_muted: z.boolean({ error: 'Muted is either true or false.' }).default(false),
  rest_seconds_by_exercise: z
    .record(
      z.uuid(),
      z
        .int({ error: 'Enter a whole number of seconds.' })
        .min(0, { error: 'A rest cannot be negative.' })
        .max(MAX_REST_SECONDS, {
          error: `A rest cannot be longer than ${String(MAX_REST_SECONDS)} seconds.`,
        }),
      {
        error: (issue) =>
          issue.code === 'invalid_key'
            ? 'A rest length belongs to an exercise id.'
            : 'Enter the rest lengths by exercise.',
      },
    )
    .default({}),
  calorie_goal: z
    .int({ error: 'Enter a whole number of calories.' })
    .min(1, { error: 'A calorie goal must be at least 1.' })
    .max(MAX_CALORIES_BURNT, {
      error: `A calorie goal cannot be above ${String(MAX_CALORIES_BURNT)}.`,
    })
    .nullable()
    .default(null),
  gym_goal_seconds: goalSeconds,
  walk_goal_seconds: goalSeconds,
  sessions_per_week_goal: z
    .int({ error: 'Enter a whole number of sessions.' })
    .min(1, { error: 'A session goal must be at least 1 a week.' })
    .max(MAX_SESSIONS_PER_WEEK, {
      error: `A session goal cannot be above ${String(MAX_SESSIONS_PER_WEEK)} a week.`,
    })
    .nullable()
    .default(null),
  birth_year: z
    .int({ error: 'Enter a year such as 1990.' })
    .min(MIN_BIRTH_YEAR, { error: `A birth year cannot be before ${String(MIN_BIRTH_YEAR)}.` })
    .refine((year) => year <= maxBirthYear(), {
      error: `A birth year must be at least ${String(MIN_AGE_YEARS)} years ago.`,
    })
    .nullable()
    .default(null),
  max_heart_rate: z
    .int({ error: 'Enter a whole heart rate.' })
    .min(MIN_HEART_RATE, {
      error: `A heart rate cannot be below ${String(MIN_HEART_RATE)} bpm.`,
    })
    .max(MAX_HEART_RATE, {
      error: `A heart rate cannot be above ${String(MAX_HEART_RATE)} bpm.`,
    })
    .nullable()
    .default(null),
  stats_layout: z
    .array(statsLayoutItemSchema, { error: 'Enter the card layout as a list.' })
    .max(MAX_STATS_CARDS, {
      error: `A layout holds at most ${String(MAX_STATS_CARDS)} cards.`,
    })
    .nullable()
    .default(null),
})

export type UnitSystem = z.infer<typeof unitSystemSchema>

export type StatsLayoutStored = z.infer<typeof statsLayoutItemSchema>

export type ProfileInput = z.infer<typeof profileSchema>

export type ProfileDraft = z.input<typeof profileSchema>
