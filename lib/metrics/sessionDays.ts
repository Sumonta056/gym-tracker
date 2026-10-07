import { hasSession } from './gymTime'

import type { DailyEntry, WorkoutSession } from '../db/dexie'

export type SessionRow = Pick<
  WorkoutSession,
  'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'
>

type DayRow = Pick<DailyEntry, 'entry_date' | 'gym_seconds'>

export function sessionsByDate<Row extends SessionRow>(
  sessions: readonly Row[],
): Map<string, Row[]> {
  const byDate = new Map<string, Row[]>()

  for (const session of sessions) {
    byDate.set(session.entry_date, [...(byDate.get(session.entry_date) ?? []), session])
  }

  return byDate
}

export function sessionDays(rows: readonly DayRow[], sessions: readonly SessionRow[]): string[] {
  const entries = new Map(rows.map((row) => [row.entry_date, row]))
  const byDate = sessionsByDate(sessions)
  const dates = new Set([...entries.keys(), ...byDate.keys()])

  return [...dates].filter((date) => hasSession(entries.get(date), byDate.get(date) ?? [])).sort()
}
