import { z } from 'zod'

export const MAX_EXERCISE_NAME_LENGTH = 80

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
] as const

export const muscleGroupSchema = z.enum(MUSCLE_GROUPS, { error: 'Pick a muscle group.' })

export const exerciseSchema = z.object({
  name: z
    .string({ error: 'Enter a name for the exercise.' })
    .trim()
    .min(1, { error: 'Enter a name for the exercise.' })
    .max(MAX_EXERCISE_NAME_LENGTH, {
      error: `A name cannot be longer than ${String(MAX_EXERCISE_NAME_LENGTH)} characters.`,
    }),
  muscle_group: muscleGroupSchema,
  is_archived: z.boolean({ error: 'Archived is either true or false.' }).default(false),
})

export type MuscleGroup = z.infer<typeof muscleGroupSchema>

export type ExerciseInput = z.infer<typeof exerciseSchema>

export type ExerciseDraft = z.input<typeof exerciseSchema>
