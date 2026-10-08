import type { WorkoutSession } from '../db/dexie'

export function sessionLengthSeconds(
  session: Pick<WorkoutSession, 'started_at' | 'ended_at'>,
): number | null {
  if (session.ended_at === null) {
    return null
  }

  return Math.max(
    0,
    Math.floor((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 1000),
  )
}
