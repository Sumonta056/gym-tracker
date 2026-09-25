'use client'

import { useEffect, useState } from 'react'

import { getProfile, listRange } from '../../lib/db/repository'
import { localDate } from '../../lib/schema/dailyEntry'

import { HISTORY_START, summarise } from './summary'

import type { DashboardSummary } from './summary'

export type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: DashboardSummary }

export const READ_ERROR = 'The entries on this device could not be read.'

function systemClock(): Date {
  return new Date()
}

export function useDashboard(clock: () => Date = systemClock): DashboardState {
  const [state, setState] = useState<DashboardState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const now = clock()
    const today = localDate(now)

    void Promise.all([listRange(HISTORY_START, today), getProfile()]).then(
      ([entries, profile]) => {
        if (!cancelled) {
          setState({ status: 'ready', summary: summarise(entries, profile, today, now) })
        }
      },
      () => {
        if (!cancelled) {
          setState({ status: 'error', message: READ_ERROR })
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [clock])

  return state
}
