'use client'

import { analyseLifts } from './liftData'
import { OneRepMaxChart } from './OneRepMaxChart'
import { RecordList } from './RecordList'
import { VolumeLoadChart } from './VolumeLoadChart'

import type { RangeTab } from './rangeData'
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
  const lifts = analyseLifts(source.sessions, source.sets, source.exercises, tab, today)

  return (
    <div data-testid={testId} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      <VolumeLoadChart
        volumes={lifts.volumes}
        weekChange={lifts.weekChange}
        tab={tab}
        unit={unit}
      />
      <OneRepMaxChart sessions={lifts.sessions} options={lifts.options} unit={unit} />
      <RecordList records={lifts.records} today={today} unit={unit} className="md:col-span-2" />
    </div>
  )
}
