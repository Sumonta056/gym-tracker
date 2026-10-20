'use client'

import { muscleBalance } from '../../lib/metrics/muscleBalance'
import { weekOf } from '../dashboard/summary'

import { CaloriesChart } from './CaloriesChart'
import { CaloriesPerMinuteChart } from './CaloriesPerMinuteChart'
import {
  CaloriesDayCard,
  HeartRateDayCard,
  StepsDayCard,
  WalkDayCard,
  WeightDayCard,
} from './DayCards'
import { HeartRateChart } from './HeartRateChart'
import { MuscleBalanceChart } from './MuscleBalanceChart'
import { OneRepMaxChart } from './OneRepMaxChart'
import { RecordList } from './RecordList'
import { SessionGapChart } from './SessionGapChart'
import { STATS_CARDS } from './statsCards'
import { StepsChart } from './StepsChart'
import { StreakHeatMap } from './StreakHeatMap'
import { TotalsChart } from './TotalsChart'
import { VolumeLoadChart } from './VolumeLoadChart'
import { WalkChart } from './WalkChart'
import { WeightChart } from './WeightChart'
import { ZoneSplitChart } from './ZoneSplitChart'

import type { LiftAnalytics } from './liftData'
import type { AnalyticsData, DayPoint, RangeTab } from './rangeData'
import type { StatsCardId } from './statsCards'
import type { LiftSource } from './useLiftData'
import type { MuscleBalance } from '../../lib/metrics/muscleBalance'
import type { MuscleGroup } from '../../lib/schema/exercise'
import type { UnitSystem } from '../../lib/schema/profile'

export type StatsCardContext = {
  daily: AnalyticsData | null
  lifts: { analysis: LiftAnalytics; unit: UnitSystem; tab: RangeTab; today: string } | null
  week: { source: LiftSource; days: DayPoint[]; today: string; sessionDates: string[] } | null
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

export function DayCard({
  id,
  daily,
  className,
}: {
  id: StatsCardId
  daily: AnalyticsData
  className: string | undefined
}) {
  const days = daily.recentDays

  switch (id) {
    case 'weight':
      return (
        <WeightDayCard
          days={days}
          unit={daily.unitSystem}
          targetKg={daily.goals.weightKg}
          className={className}
        />
      )
    case 'calories':
      return <CaloriesDayCard days={days} goal={daily.goals.calories} className={className} />
    case 'steps':
      return <StepsDayCard days={days} stepGoal={daily.stepGoal} className={className} />
    case 'walk':
      return <WalkDayCard days={days} goalSeconds={daily.goals.walkSeconds} className={className} />
    default:
      return <HeartRateDayCard days={days} className={className} />
  }
}

export const DAY_CARD_IDS: ReadonlySet<StatsCardId> = new Set([
  'weight',
  'calories',
  'steps',
  'walk',
  'heart-rate',
])

export type StatsCardProps = {
  id: StatsCardId
  context: StatsCardContext
}

export function StatsCard({ id, context }: StatsCardProps) {
  const className = STATS_CARDS[id].wide ? 'md:col-span-2' : undefined
  const { daily, lifts, week } = context

  if (daily?.tab === 'day' && DAY_CARD_IDS.has(id)) {
    return <DayCard id={id} daily={daily} className={className} />
  }

  switch (id) {
    case 'weight':
      return daily === null ? null : (
        <WeightChart
          days={daily.days}
          tab={daily.tab}
          unit={daily.unitSystem}
          targetKg={daily.goals.weightKg}
          className={className}
        />
      )
    case 'calories':
      return daily === null ? null : (
        <CaloriesChart
          days={daily.days}
          tab={daily.tab}
          goal={daily.goals.calories}
          className={className}
        />
      )
    case 'steps':
      return daily === null ? null : (
        <StepsChart
          days={daily.days}
          tab={daily.tab}
          stepGoal={daily.stepGoal}
          className={className}
        />
      )
    case 'walk':
      return daily === null ? null : (
        <WalkChart
          days={daily.days}
          tab={daily.tab}
          goalSeconds={daily.goals.walkSeconds}
          className={className}
        />
      )
    case 'heart-rate':
      return daily === null ? null : (
        <HeartRateChart days={daily.days} tab={daily.tab} className={className} />
      )
    case 'zone-split':
      return daily === null ? null : (
        <ZoneSplitChart
          zones={daily.zones}
          date={daily.today}
          maxHeartRate={daily.maxHeartRate}
          className={className}
        />
      )
    case 'streak':
      return daily === null ? null : (
        <StreakHeatMap
          weeks={daily.heatMap}
          streak={daily.streak}
          today={daily.today}
          className={className}
        />
      )
    case 'totals':
      return daily === null ? null : (
        <TotalsChart
          days={daily.days}
          totals={daily.totals}
          tab={daily.tab}
          goalSeconds={daily.goals.gymSeconds}
          className={className}
        />
      )
    case 'volume-load':
      return lifts === null ? null : (
        <VolumeLoadChart
          volumes={lifts.analysis.volumes}
          weekChange={lifts.analysis.weekChange}
          tab={lifts.tab}
          unit={lifts.unit}
          className={className}
        />
      )
    case 'one-rep-max':
      return lifts === null ? null : (
        <OneRepMaxChart
          sessions={lifts.analysis.sessions}
          options={lifts.analysis.options}
          unit={lifts.unit}
          className={className}
        />
      )
    case 'records':
      return lifts === null ? null : (
        <RecordList
          records={lifts.analysis.records}
          today={lifts.today}
          unit={lifts.unit}
          className={className}
        />
      )
    case 'muscle-balance':
      return week === null ? null : (
        <MuscleBalanceChart balance={weekBalance(week.source, week.today)} className={className} />
      )
    case 'session-gaps':
      return week === null ? null : (
        <SessionGapChart dates={week.sessionDates} className={className} />
      )
    case 'calories-per-minute':
      return week === null ? null : (
        <CaloriesPerMinuteChart days={week.days} className={className} />
      )
  }
}
