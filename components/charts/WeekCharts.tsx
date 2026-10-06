'use client'

import { muscleBalance } from '../../lib/metrics/muscleBalance'
import { weekOf } from '../dashboard/summary'

import { CaloriesPerMinuteChart } from './CaloriesPerMinuteChart'
import { MuscleBalanceChart } from './MuscleBalanceChart'
import { SessionGapChart } from './SessionGapChart'

import type { DayPoint } from './rangeData'
import type { LiftSource } from './useLiftData'
import type { MuscleBalance } from '../../lib/metrics/muscleBalance'
import type { MuscleGroup } from '../../lib/schema/exercise'

export type WeekChartsProps = {
  source: LiftSource
  days: DayPoint[]
  sessionDates: string[]
  today: string
  testId?: string
}

export function weekBalance(source: LiftSource, today: string): MuscleBalance {
  const week = weekOf(today)
  const inWeek = new Set(
    source.sessions
      .filter((session) => session.entry_date >= week.from && session.entry_date <= week.to)
      .map((session) => session.id),
  )
  const groups: Record<string, MuscleGroup> = Object.fromEntries(
    source.exercises.map((exercise) => [exercise.id, exercise.muscle_group]),
  )

  return muscleBalance(
    source.sets.filter((set) => inWeek.has(set.session_id)),
    groups,
  )
}

export function WeekCharts({
  source,
  days,
  sessionDates,
  today,
  testId = 'week-grid',
}: WeekChartsProps) {
  return (
    <div data-testid={testId} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      <MuscleBalanceChart balance={weekBalance(source, today)} />
      <SessionGapChart dates={sessionDates} />
      <CaloriesPerMinuteChart days={days} className="md:col-span-2" />
    </div>
  )
}
