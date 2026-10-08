'use client'

import { useEffect, useMemo, useState } from 'react'

import { getProfile, listRange, listSessions } from '../../lib/db/repository'
import { localDate } from '../../lib/schema/dailyEntry'
import { HISTORY_START } from '../dashboard/summary'

import { analyse, chartGoals, rangeFor, readWindow } from './rangeData'
import { HISTORY_END } from './useLiftData'

import type { AnalyticsData, RangeTab } from './rangeData'
import type { DailyEntry, Profile, WorkoutSession } from '../../lib/db/dexie'

export type AnalyticsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: AnalyticsData }

type Source = {
  history: DailyEntry[]
  sessions: WorkoutSession[]
  profile: Profile
  today: string
  now: Date
}

type Loaded =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; source: Source }

export const READ_ERROR = 'The entries on this device could not be read.'

function systemClock(): Date {
  return new Date()
}

export function entriesIn(
  history: readonly DailyEntry[],
  tab: RangeTab,
  today: string,
): DailyEntry[] {
  const span = readWindow(rangeFor(tab, today))

  return history.filter((row) => row.entry_date >= span.from && row.entry_date <= span.to)
}

export function useAnalytics(tab: RangeTab, clock: () => Date = systemClock): AnalyticsState {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const now = clock()
    const today = localDate(now)

    void Promise.all([
      listRange(HISTORY_START, HISTORY_END),
      listSessions(HISTORY_START, HISTORY_END),
      getProfile(),
    ]).then(
      ([history, sessions, profile]) => {
        if (!cancelled) {
          setLoaded({ status: 'ready', source: { history, sessions, profile, today, now } })
        }
      },
      () => {
        if (!cancelled) {
          setLoaded({ status: 'error', message: READ_ERROR })
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [clock])

  return useMemo((): AnalyticsState => {
    if (loaded.status !== 'ready') {
      return loaded
    }

    const { history, sessions, profile, today, now } = loaded.source

    return {
      status: 'ready',
      data: analyse(
        entriesIn(history, tab, today),
        history,
        tab,
        today,
        now,
        profile.step_goal,
        profile.unit_system,
        sessions,
        chartGoals(profile),
      ),
    }
  }, [loaded, tab])
}
