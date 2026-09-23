'use client'

import { useEffect, useState } from 'react'

import { getProfile, listRange } from '../../lib/db/repository'
import { localDate } from '../../lib/schema/dailyEntry'
import { HISTORY_START } from '../dashboard/summary'

import { analyse, rangeFor, readWindow } from './rangeData'

import type { AnalyticsData, RangeTab } from './rangeData'

export type AnalyticsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: AnalyticsData }

type Settled = { tab: RangeTab; state: Exclude<AnalyticsState, { status: 'loading' }> }

export const READ_ERROR = 'The entries on this device could not be read.'

function systemClock(): Date {
  return new Date()
}

export function useAnalytics(tab: RangeTab, clock: () => Date = systemClock): AnalyticsState {
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    let cancelled = false
    const now = clock()
    const today = localDate(now)
    const span = readWindow(rangeFor(tab, today))

    void Promise.all([
      listRange(span.from, span.to),
      listRange(HISTORY_START, today),
      getProfile(),
    ]).then(
      ([entries, history, profile]) => {
        if (!cancelled) {
          setSettled({
            tab,
            state: {
              status: 'ready',
              data: analyse(entries, history, tab, today, now, profile.step_goal),
            },
          })
        }
      },
      () => {
        if (!cancelled) {
          setSettled({ tab, state: { status: 'error', message: READ_ERROR } })
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [tab, clock])

  if (settled === null || settled.tab !== tab) {
    return { status: 'loading' }
  }

  return settled.state
}
