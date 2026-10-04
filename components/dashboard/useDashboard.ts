'use client'

import { useLiveQuery } from 'dexie-react-hooks'

import { getProfile, listRange } from '../../lib/db/repository'
import { localDate } from '../../lib/schema/dailyEntry'

import { HISTORY_START, summarise } from './summary'

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

async function readDashboard(clock: () => Date): Promise<DashboardState> {
  const now = clock()
  const today = localDate(now)

  try {
    const [entries, profile] = await Promise.all([listRange(HISTORY_START, today), getProfile()])

    return { status: 'ready', summary: summarise(entries, profile, today, now) }
  } catch {
    return { status: 'error', message: READ_ERROR }
  }
}

export function useDashboard(clock: () => Date = systemClock): DashboardState {
  return useLiveQuery(() => readDashboard(clock), [clock], LOADING)
}
