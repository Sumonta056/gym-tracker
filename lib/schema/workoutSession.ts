import { z } from 'zod'

import { isNotFuture } from './dailyEntry'

export const WORKOUT_SESSION_STATUSES = ['active', 'finished'] as const

export const workoutSessionStatusSchema = z.enum(WORKOUT_SESSION_STATUSES, {
  error: 'A session is either active or finished.',
})

const sessionDate = z.iso.date({ error: 'Enter a date as YYYY-MM-DD.' })

const sessionFields = {
  started_at: z.iso.datetime({
    offset: true,
    error: 'Enter a start time as an ISO timestamp.',
  }),
  ended_at: z.iso
    .datetime({ offset: true, error: 'Enter an end time as an ISO timestamp.' })
    .nullable()
    .default(null),
  status: workoutSessionStatusSchema.default('active'),
}

interface SessionTimes {
  started_at: string
  ended_at: string | null
  status: WorkoutSessionStatus
}

function withSessionRules<T extends z.ZodType<SessionTimes>>(schema: T): T {
  return schema
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
}

export const workoutSessionSchema = withSessionRules(
  z.object({
    entry_date: sessionDate.refine((value) => isNotFuture(value), {
      error: 'A date cannot be in the future.',
    }),
    ...sessionFields,
  }),
)

export const storedWorkoutSessionSchema = withSessionRules(
  z.object({ entry_date: sessionDate, ...sessionFields }),
)

export type WorkoutSessionStatus = z.infer<typeof workoutSessionStatusSchema>

export type WorkoutSessionInput = z.infer<typeof workoutSessionSchema>

export type WorkoutSessionDraft = z.input<typeof workoutSessionSchema>
