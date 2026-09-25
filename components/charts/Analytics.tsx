'use client'

import { useState } from 'react'

import { SyncChip } from '../sync/SyncChip'
import { SegmentedTabs } from '../ui/SegmentedTabs'

import { CaloriesChart } from './CaloriesChart'
import { HeartRateChart } from './HeartRateChart'
import { RANGE_TABS } from './rangeData'
import { StepsChart } from './StepsChart'
import { StreakHeatMap } from './StreakHeatMap'
import { TotalsChart } from './TotalsChart'
import { useAnalytics } from './useAnalytics'
import { WeightChart } from './WeightChart'
import { ZoneSplitChart } from './ZoneSplitChart'

import type { AnalyticsData, RangeTab } from './rangeData'

export type AnalyticsHeaderProps = {
  label: string | null
}

export function AnalyticsHeader({ label }: AnalyticsHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]">Stats</h1>
        {label === null ? null : <p className="text-muted text-[13px]">{label}</p>}
      </div>
      <SyncChip className="shrink-0" />
    </header>
  )
}

export type RangeTabsProps = {
  value: RangeTab
  onValueChange: (value: RangeTab) => void
}

export function RangeTabs({ value, onValueChange }: RangeTabsProps) {
  return (
    <SegmentedTabs
      label="Range"
      options={RANGE_TABS}
      value={value}
      onValueChange={onValueChange}
      className="mt-4"
    />
  )
}

export type AnalyticsViewProps = {
  data: AnalyticsData
  testId?: string
}

export function AnalyticsView({ data, testId = 'analytics-grid' }: AnalyticsViewProps) {
  return (
    <div data-testid={testId} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <WeightChart days={data.days} tab={data.tab} unit={data.unitSystem} />
      <CaloriesChart days={data.days} tab={data.tab} />
      <StepsChart days={data.days} tab={data.tab} stepGoal={data.stepGoal} />
      <HeartRateChart days={data.days} tab={data.tab} />
      <ZoneSplitChart zones={data.zones} date={data.today} />
      <StreakHeatMap weeks={data.heatMap} streak={data.streak} />
      <TotalsChart days={data.days} totals={data.totals} tab={data.tab} className="md:col-span-2" />
    </div>
  )
}

export type AnalyticsProps = {
  clock?: () => Date
}

export function Analytics({ clock }: AnalyticsProps) {
  const [tab, setTab] = useState<RangeTab>('week')
  const state = useAnalytics(tab, clock)

  return (
    <>
      <AnalyticsHeader label={state.status === 'ready' ? state.data.label : null} />
      <RangeTabs value={tab} onValueChange={setTab} />

      {state.status === 'loading' ? (
        <p role="status" className="text-muted mt-4 text-sm">
          Reading this device…
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {state.message}
        </p>
      ) : null}

      {state.status === 'ready' ? <AnalyticsView data={state.data} /> : null}
    </>
  )
}
