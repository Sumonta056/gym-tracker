'use client'

import { analyseLifts } from './liftData'
import { StatsCard } from './StatsCard'
import { cardsInGroup } from './statsCards'

import type { RangeTab } from './rangeData'
import type { StatsCardContext } from './StatsCard'
import type { LiftSource } from './useLiftData'
import type { UnitSystem } from '../../lib/schema/profile'

export type LiftChartsProps = {
  source: LiftSource
  tab: RangeTab
  today: string
  unit?: UnitSystem
  testId?: string
}

export function LiftCharts({
  source,
  tab,
  today,
  unit = 'metric',
  testId = 'lift-grid',
}: LiftChartsProps) {
  const analysis = analyseLifts(source.sessions, source.sets, source.exercises, tab, today)
  const context: StatsCardContext = {
    daily: null,
    lifts: { analysis, unit, tab, today },
    week: null,
  }

  return (
    <div data-testid={testId} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      {cardsInGroup('lift').map((id) => (
        <StatsCard key={id} id={id} context={context} />
      ))}
    </div>
  )
}
