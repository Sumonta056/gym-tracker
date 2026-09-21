import { z } from 'zod'

export const MIN_HEART_RATE = 30
export const MAX_HEART_RATE = 230
export const MIN_WEIGHT_KG = 20
export const MAX_WEIGHT_KG = 300
export const MAX_CALORIES_BURNT = 10000
export const MAX_STEPS = 200000

export function localDate(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function isNotFuture(entryDate: string, today: string = localDate()): boolean {
  return entryDate <= today
}

const seconds = z
  .int({ error: 'Enter a whole number of seconds.' })
  .min(0, { error: 'A duration cannot be negative.' })
  .nullable()
  .default(null)

const heartRate = z
  .int({ error: 'Enter a whole heart rate.' })
  .min(MIN_HEART_RATE, { error: `A heart rate cannot be below ${String(MIN_HEART_RATE)} bpm.` })
  .max(MAX_HEART_RATE, { error: `A heart rate cannot be above ${String(MAX_HEART_RATE)} bpm.` })
  .nullable()
  .default(null)

export const dailyEntrySchema = z
  .object({
    entry_date: z.iso
      .date({ error: 'Enter a date as YYYY-MM-DD.' })
      .refine((value) => isNotFuture(value), { error: 'A date cannot be in the future.' }),
    walk_seconds: seconds,
    gym_seconds: seconds,
    avg_heart_rate: heartRate,
    max_heart_rate: heartRate,
    weight_kg: z
      .number({ error: 'Enter a weight in kilograms.' })
      .min(MIN_WEIGHT_KG, { error: `A weight cannot be below ${String(MIN_WEIGHT_KG)} kg.` })
      .max(MAX_WEIGHT_KG, { error: `A weight cannot be above ${String(MAX_WEIGHT_KG)} kg.` })
      .multipleOf(0.01, { error: 'A weight takes at most two decimals.' })
      .nullable()
      .default(null),
    calories_burnt: z
      .int({ error: 'Enter a whole number of calories.' })
      .min(0, { error: 'Calories cannot be negative.' })
      .max(MAX_CALORIES_BURNT, {
        error: `Calories cannot be above ${String(MAX_CALORIES_BURNT)}.`,
      })
      .nullable()
      .default(null),
    steps: z
      .int({ error: 'Enter a whole number of steps.' })
      .min(0, { error: 'Steps cannot be negative.' })
      .max(MAX_STEPS, { error: `Steps cannot be above ${String(MAX_STEPS)}.` })
      .nullable()
      .default(null),
    note: z.string().trim().nullable().default(null),
  })
  .refine(
    (entry) =>
      entry.avg_heart_rate === null ||
      entry.max_heart_rate === null ||
      entry.max_heart_rate >= entry.avg_heart_rate,
    {
      error: 'The peak heart rate cannot be below the average.',
      path: ['max_heart_rate'],
    },
  )

export type DailyEntryInput = z.infer<typeof dailyEntrySchema>

export type DailyEntryDraft = z.input<typeof dailyEntrySchema>
