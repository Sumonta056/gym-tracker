import { MAX_DURATION_SECONDS } from '../duration'

import type { DailyEntry, WorkoutSession } from '../db/dexie'

export type GymTimeOffer = {
  sessionId: string
  entryDate: string
  sessionSeconds: number
  loggedSeconds: number | null
}

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

function isLiveFinished(session: WorkoutSession): boolean {
  return session.status === 'finished' && session.deleted_at === null
}

export function gymTimeOffer(
  session: WorkoutSession,
  day: DailyEntry | undefined,
): GymTimeOffer | null {
  if (!isLiveFinished(session)) {
    return null
  }

  const seconds = sessionLengthSeconds(session)

  if (seconds === null || seconds === 0 || seconds > MAX_DURATION_SECONDS) {
    return null
  }

  const logged = day?.gym_seconds ?? null

  if (logged === seconds) {
    return null
  }

  return {
    sessionId: session.id,
    entryDate: session.entry_date,
    sessionSeconds: seconds,
    loggedSeconds: logged,
  }
}

export function newestFinished(sessions: readonly WorkoutSession[]): WorkoutSession | undefined {
  return sessions
    .filter(isLiveFinished)
    .sort(
      (left, right) =>
        right.started_at.localeCompare(left.started_at) || left.id.localeCompare(right.id),
    )[0]
}
