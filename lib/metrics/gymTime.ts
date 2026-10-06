import { sessionLengthSeconds } from '../workout/gymTime'

import type { DailyEntry, WorkoutSession } from '../db/dexie'

export type GymTimeSource = 'typed' | 'sessions' | 'none'

type GymTimeSession = Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>

const NONE = { seconds: 0, source: 'none' } as const

function finishedLengths(sessions: GymTimeSession[]): number[] {
  return sessions.flatMap((session) => {
    const length = session.deleted_at === null ? sessionLengthSeconds(session) : null

    return length === null ? [] : [length]
  })
}

export function effectiveGymSeconds(
  entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
  sessions: GymTimeSession[],
): { seconds: number; source: GymTimeSource } {
  const typed = entry?.gym_seconds ?? null

  if (typed !== null) {
    return { seconds: typed, source: 'typed' }
  }

  const lengths = finishedLengths(sessions)

  if (lengths.length === 0) {
    return NONE
  }

  return {
    seconds: lengths.reduce((total, length) => total + length, 0),
    source: 'sessions',
  }
}

export function hasSession(
  entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
  sessions: GymTimeSession[],
): boolean {
  return effectiveGymSeconds(entry, sessions).seconds > 0
}
