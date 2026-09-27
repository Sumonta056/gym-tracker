import { z } from 'zod'

import { isNotFuture } from './dailyEntry'

export const WORKOUT_SESSION_STATUSES = ['active', 'finished'] as const

export const workoutSessionStatusSchema = z.enum(WORKOUT_SESSION_STATUSES, {
  error: 'A session is either active or finished.',
})

export const workoutSessionSchema = z
  .object({
    entry_date: z.iso
      .date({ error: 'Enter a date as YYYY-MM-DD.' })
      .refine((value) => isNotFuture(value), { error: 'A date cannot be in the future.' }),
    started_at: z.iso.datetime({
      offset: true,
      error: 'Enter a start time as an ISO timestamp.',
    }),
    ended_at: z.iso
      .datetime({ offset: true, error: 'Enter an end time as an ISO timestamp.' })
      .nullable()
      .default(null),
    status: workoutSessionStatusSchema.default('active'),
  })
  .refine(
    (session) =>
      session.ended_at === null || Date.parse(session.ended_at) >= Date.parse(session.started_at),
    { error: 'A session cannot end before it starts.', path: ['ended_at'] },
  )
  .refine((session) => session.status !== 'finished' || session.ended_at !== null, {
    error: 'A finished session needs an end time.',
    path: ['ended_at'],
  })
  .refine((session) => session.status !== 'active' || session.ended_at === null, {
    error: 'An active session has no end time.',
    path: ['ended_at'],
  })

export type WorkoutSessionStatus = z.infer<typeof workoutSessionStatusSchema>

export type WorkoutSessionInput = z.infer<typeof workoutSessionSchema>

export type WorkoutSessionDraft = z.input<typeof workoutSessionSchema>
