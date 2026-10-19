'use client'

import { useLiveQuery } from 'dexie-react-hooks'

import {
  getProfile,
  listRange,
  listSessions,
  listSetsInRange,
  setsForExercises,
} from '../../lib/db/repository'
import { localNoon } from '../../lib/format/logDate'
import { localDate } from '../../lib/schema/dailyEntry'

import { HISTORY_START, summarise, weekOf } from './summary'

import type { DashboardSummary } from './summary'

export type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: DashboardSummary }

export const READ_ERROR = 'The entries on this device could not be read.'

const LOADING: DashboardState = { status: 'loading' }

function systemClock(): Date {
  return new Date()
}

export function momentOf(date: string, now: Date): Date {
  return date === localDate(now) ? now : localNoon(date)
}

async function readDashboard(date: string, clock: () => Date): Promise<DashboardState> {
  const now = clock()

  try {
    const week = weekOf(date)
    const [entries, profile, sessions, sets] = await Promise.all([
      listRange(HISTORY_START, date),
      getProfile(),
      listSessions(week.from, date),
      listSetsInRange(date, date),
    ])
    const earlierSets = await setsForExercises([...new Set(sets.map((set) => set.exercise_id))])

    return {
      status: 'ready',
      summary: summarise(entries, profile, date, momentOf(date, now), {
        sessions,
        sets,
        earlierSets,
      }),
    }
  } catch {
    return { status: 'error', message: READ_ERROR }
  }
}

export function useDashboard(date: string, clock: () => Date = systemClock): DashboardState {
  return useLiveQuery(() => readDashboard(date, clock), [date, clock], LOADING)
}
