'use client'

import { useEffect, useState } from 'react'

import { listExercises, listSessions, listSetsInRange } from '../../lib/db/repository'
import { HISTORY_START } from '../dashboard/summary'

import type { Exercise, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'

export type LiftSource = {
  sessions: WorkoutSession[]
  sets: WorkoutSet[]
  exercises: Exercise[]
}

export type LiftDataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; source: LiftSource }

export const LIFT_READ_ERROR = 'The workouts on this device could not be read.'

export const HISTORY_END = '9999-12-31'

export function useLiftData(): LiftDataState {
  const [state, setState] = useState<LiftDataState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      listSessions(HISTORY_START, HISTORY_END),
      listSetsInRange(HISTORY_START, HISTORY_END),
      listExercises({ includeArchived: true }),
    ]).then(
      ([sessions, sets, exercises]) => {
        if (!cancelled) {
          setState({ status: 'ready', source: { sessions, sets, exercises } })
        }
      },
      () => {
        if (!cancelled) {
          setState({ status: 'error', message: LIFT_READ_ERROR })
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
