import { personalRecords } from './personalRecords'
import { volumeLoad } from './volumeLoad'

import type { WorkoutSession, WorkoutSet } from '../db/dexie'

export type SessionRecord = { exerciseId: string; weightKg: number; reps: number }

export type SessionStats = {
  durationSeconds: number
  setCount: number
  exerciseCount: number
  volumeKg: number
  newRecords: SessionRecord[]
}

type Weighted = WorkoutSet & { weight_kg: number }

const MS_PER_SECOND = 1000

function durationOf(session: WorkoutSession): number {
  if (session.ended_at === null) {
    return 0
  }

  const span = Date.parse(session.ended_at) - Date.parse(session.started_at)

  return Math.max(0, Math.round(span / MS_PER_SECOND))
}

function doneAt(set: WorkoutSet): number {
  return Date.parse(set.completed_at ?? set.created_at)
}

function isWeighted(set: WorkoutSet): set is Weighted {
  return set.weight_kg !== null
}

function heaviest(sets: readonly Weighted[]): Weighted | undefined {
  let best: Weighted | undefined

  for (const set of sets) {
    if (best === undefined || set.weight_kg > best.weight_kg) {
      best = set
    }
  }

  return best
}

function newRecords(
  session: WorkoutSession,
  live: readonly WorkoutSet[],
  earlierSets: readonly WorkoutSet[],
): SessionRecord[] {
  const start = Date.parse(session.started_at)
  const before = earlierSets.filter((set) => set.session_id !== session.id && doneAt(set) < start)
  const best = personalRecords(before)
  const exerciseIds = [...new Set(live.map((set) => set.exercise_id))]

  return exerciseIds.flatMap((exerciseId) => {
    const earlierBest = best[exerciseId]?.bestLoad ?? null
    const top = heaviest(live.filter((set) => set.exercise_id === exerciseId).filter(isWeighted))

    if (earlierBest === null || top === undefined || top.weight_kg <= earlierBest.weightKg) {
      return []
    }

    return [{ exerciseId, weightKg: top.weight_kg, reps: top.reps }]
  })
}

export function sessionStats(
  session: WorkoutSession,
  sets: WorkoutSet[],
  earlierSets: WorkoutSet[],
): SessionStats {
  const live = sets.filter((set) => set.session_id === session.id && set.deleted_at === null)

  return {
    durationSeconds: durationOf(session),
    setCount: live.length,
    exerciseCount: new Set(live.map((set) => set.exercise_id)).size,
    volumeKg: volumeLoad(live),
    newRecords: newRecords(session, live, earlierSets),
  }
}

export type DayTotals = {
  durationSeconds: number
  setCount: number
  volumeKg: number
  recordCount: number
}

export function dayTotals(sessions: readonly SessionStats[]): DayTotals {
  return sessions.reduce<DayTotals>(
    (sum, stats) => ({
      durationSeconds: sum.durationSeconds + stats.durationSeconds,
      setCount: sum.setCount + stats.setCount,
      volumeKg: sum.volumeKg + stats.volumeKg,
      recordCount: sum.recordCount + stats.newRecords.length,
    }),
    { durationSeconds: 0, setCount: 0, volumeKg: 0, recordCount: 0 },
  )
}
