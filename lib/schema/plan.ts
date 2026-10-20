import { z } from 'zod'

export const PLAN_IDS = ['chest-triceps', 'back-biceps', 'shoulders', 'legs'] as const

export const MUSCLES = [
  'chest',
  'shoulders',
  'neck',
  'triceps',
  'biceps',
  'forearms',
  'abdominals',
  'obliques',
  'lats',
  'middle back',
  'lower back',
  'traps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
] as const

export const IMAGE_PATH = /^\/exercises\/[a-z0-9-]+-(start|end)\.webp$/

export const planIdSchema = z.enum(PLAN_IDS, { error: 'Pick a coach plan.' })

export const muscleSchema = z.enum(MUSCLES, { error: 'Pick a muscle.' })

const imagePath = z.string().regex(IMAGE_PATH, {
  error: 'An image path is /exercises/<slug>-start.webp or /exercises/<slug>-end.webp.',
})

export const planVideoSchema = z.object({
  url: z.url({ protocol: /^https$/, error: 'A video link starts with https://.' }),
  kind: z.enum(['search', 'video'], { error: 'A video is either a search or a video.' }),
  length: z.string().optional(),
})

export const planTargetSchema = z
  .object({
    sets: z.int().positive({ error: 'A target needs 1 or more sets.' }),
    repsMin: z.int().positive({ error: 'A target needs 1 or more reps.' }),
    repsMax: z.int().positive({ error: 'A target needs 1 or more reps.' }),
  })
  .refine((target) => target.repsMin <= target.repsMax, {
    error: 'The lowest reps cannot be above the highest reps.',
    path: ['repsMin'],
  })

export const planStepSchema = z.object({
  exerciseId: z.uuid({ error: 'An exercise id is a UUID.' }),
  slug: z.string().regex(/^[a-z0-9-]+$/, { error: 'A slug is lower case words and dashes.' }),
  name: z.string().trim().min(1, { error: 'A step needs a name.' }),
  how: z.string().trim().min(1, { error: 'A step needs the how-to text.' }),
  images: z.object({ start: imagePath, end: imagePath }),
  muscles: z.object({
    primary: z.array(muscleSchema).min(1, { error: 'A step needs 1 or more main muscles.' }),
    secondary: z.array(muscleSchema),
  }),
  video: planVideoSchema.optional(),
  target: planTargetSchema,
  bodyweight: z.boolean({ error: 'Body weight is either true or false.' }).default(false),
})

export const planGroupSchema = z.object({
  name: z.string().trim().min(1, { error: 'A group needs a name.' }),
  steps: z.array(planStepSchema).min(1, { error: 'A group needs 1 or more steps.' }),
})

export const planSchema = z.object({
  id: planIdSchema,
  title: z.string().trim().min(1, { error: 'A plan needs a title.' }),
  groups: z.array(planGroupSchema).min(1, { error: 'A plan needs 1 or more groups.' }),
  retired: z.boolean().default(false),
})

export type PlanId = z.infer<typeof planIdSchema>

export type Muscle = z.infer<typeof muscleSchema>

export type PlanVideo = z.infer<typeof planVideoSchema>

export type PlanTarget = z.infer<typeof planTargetSchema>

export type PlanStep = z.infer<typeof planStepSchema>

export type PlanGroup = z.infer<typeof planGroupSchema>

export type Plan = z.infer<typeof planSchema>
