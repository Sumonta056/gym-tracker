import { z } from 'zod'

export const MIN_REPS = 1
export const MAX_REPS = 1000
export const MAX_LOAD_KG = 500
export const MIN_RPE = 1
export const MAX_RPE = 10

export const workoutSetSchema = z.object({
  session_id: z.uuid({ error: 'A set needs the id of its session.' }),
  exercise_id: z.uuid({ error: 'A set needs the id of its exercise.' }),
  set_index: z
    .int({ error: 'Enter a whole set position.' })
    .min(0, { error: 'A set position cannot be negative.' }),
  reps: z
    .int({ error: 'Enter a whole number of reps.' })
    .min(MIN_REPS, { error: `A set needs at least ${String(MIN_REPS)} rep.` })
    .max(MAX_REPS, { error: `Reps cannot be above ${String(MAX_REPS)}.` }),
  weight_kg: z
    .number({ error: 'Enter a load in kilograms.' })
    .min(0, { error: 'A load cannot be negative.' })
    .max(MAX_LOAD_KG, { error: `A load cannot be above ${String(MAX_LOAD_KG)} kg.` })
    .multipleOf(0.01, { error: 'A load takes at most two decimals.' })
    .nullable()
    .default(null),
  rpe: z
    .int({ error: 'Enter a whole RPE.' })
    .min(MIN_RPE, { error: `An RPE cannot be below ${String(MIN_RPE)}.` })
    .max(MAX_RPE, { error: `An RPE cannot be above ${String(MAX_RPE)}.` })
    .nullable()
    .default(null),
  completed_at: z.iso
    .datetime({ offset: true, error: 'Enter a completion time as an ISO timestamp.' })
    .nullable()
    .default(null),
})

export type WorkoutSetInput = z.infer<typeof workoutSetSchema>

export type WorkoutSetDraft = z.input<typeof workoutSetSchema>
