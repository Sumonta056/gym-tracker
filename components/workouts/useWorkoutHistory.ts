'use client'

import { useLiveQuery } from 'dexie-react-hooks'

import {
  getProfile,
  getSession,
  listExercises,
  listFinishedSessions,
  listSets,
  listSetsForSessions,
  setsForExercises,
} from '../../lib/db/repository'
import { safeQuery } from '../../lib/db/safeQuery'
import { sessionStats } from '../../lib/metrics/sessionStats'

import { groupsOf } from './historyText'

import type { Exercise, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
import type { SessionStats } from '../../lib/metrics/sessionStats'
import type { MuscleGroup } from '../../lib/schema/exercise'
import type { UnitSystem } from '../../lib/schema/profile'

export const HISTORY_PAGE = 30

export type HistoryRow = { session: WorkoutSession; stats: SessionStats; groups: MuscleGroup[] }

export type HistoryList = { rows: HistoryRow[]; hasMore: boolean; unit: UnitSystem }

export type FoundSession = {
  status: 'found'
  session: WorkoutSession
  sets: WorkoutSet[]
  stats: SessionStats
  exercises: ReadonlyMap<string, Exercise>
  unit: UnitSystem
}

export type SessionView = { status: 'missing' } | { status: 'running' } | FoundSession

export async function readHistory(limit: number): Promise<HistoryList> {
  const [page, profile, catalogue] = await Promise.all([
    listFinishedSessions(limit),
    getProfile(),
    listExercises({ includeArchived: true }),
  ])
  const sets = await listSetsForSessions(page.sessions.map((session) => session.id))
  const earlier = await setsForExercises([...new Set(sets.map((set) => set.exercise_id))])
  const groupOf = new Map(catalogue.map((exercise) => [exercise.id, exercise.muscle_group]))

  return {
    rows: page.sessions.map((session) => ({
      session,
      stats: sessionStats(session, sets, earlier),
      groups: groupsOf(
        sets.filter((set) => set.session_id === session.id),
        groupOf,
      ),
    })),
    hasMore: page.hasMore,
    unit: profile.unit_system,
  }
}

export async function readSession(id: string): Promise<SessionView> {
  const session = await getSession(id)

  if (session === undefined) {
    return { status: 'missing' }
  }

  if (session.status !== 'finished') {
    return { status: 'running' }
  }

  const [sets, catalogue, profile] = await Promise.all([
    listSets(id),
    listExercises({ includeArchived: true }),
    getProfile(),
  ])
  const earlier = await setsForExercises([...new Set(sets.map((set) => set.exercise_id))])

  return {
    status: 'found',
    session,
    sets,
    stats: sessionStats(session, sets, earlier),
    exercises: new Map(catalogue.map((exercise) => [exercise.id, exercise])),
    unit: profile.unit_system,
  }
}

export function useHistory(limit: number): HistoryList | null | undefined {
  return useLiveQuery(
    safeQuery(() => readHistory(limit), 'workouts'),
    [limit],
  )
}

export function useSessionView(id: string): SessionView | null | undefined {
  return useLiveQuery(
    safeQuery(() => readSession(id), 'workouts'),
    [id],
  )
}
