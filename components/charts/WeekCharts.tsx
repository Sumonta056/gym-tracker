'use client'

import { StatsCard } from './StatsCard'
import { cardsInGroup } from './statsCards'

export { weekBalance } from './StatsCard'

import type { DayPoint } from './rangeData'
import type { StatsCardContext } from './StatsCard'
import type { LiftSource } from './useLiftData'

export type WeekChartsProps = {
  source: LiftSource
  days: DayPoint[]
  sessionDates: string[]
  today: string
  testId?: string
}

export function WeekCharts({
  source,
  days,
  sessionDates,
  today,
  testId = 'week-grid',
}: WeekChartsProps) {
  const context: StatsCardContext = {
    daily: null,
    lifts: null,
    week: { source, days, today, sessionDates },
  }

  return (
    <div data-testid={testId} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      {cardsInGroup('week').map((id) => (
        <StatsCard key={id} id={id} context={context} />
      ))}
    </div>
  )
}
