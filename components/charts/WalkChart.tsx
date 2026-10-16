'use client'

import { colorTokens } from '../../lib/design/tokens'
import { formatDuration } from '../../lib/duration'

import { ChartCard } from './ChartCard'
import { DailyBars, goalOrAverage } from './DailyBars'
import { averagePerLoggedDay, loggedDays, presentValues, sum, trendWord } from './rangeData'
import { minutes } from './TotalsChart'

import type { DayPoint, RangeTab } from './rangeData'

export type WalkChartProps = {
  days: DayPoint[]
  tab: RangeTab
  goalSeconds?: number | null
  className?: string
}

export function walkLabel(
  values: readonly number[],
  average: number | null,
  goal: number | null,
): string {
  const base = `Walk time per day, ${trendWord(values)}: ${values.map(minutes).join(', ')}. Total ${formatDuration(sum(values), 'short')}.`

  if (goal !== null) {
    return `${base} Goal ${minutes(goal)} a day.`
  }

  return average === null ? base : `${base} Average ${minutes(average)} a logged day.`
}

export function WalkChart({ days, tab, goalSeconds = null, className }: WalkChartProps) {
  const values = presentValues(days.map((day) => day.walkSeconds))
  const average = averagePerLoggedDay(sum(values), loggedDays(days))

  return (
    <ChartCard
      title="Walk"
      summary={`${formatDuration(sum(values), 'short')} total`}
      empty={values.length === 0}
      emptyText="Log your walk time to see it per day."
      label={walkLabel(values, average, goalSeconds)}
      className={className}
    >
      <DailyBars
        days={days}
        dataKey="walkSeconds"
        color={colorTokens['data-cyan']}
        tab={tab}
        formatValue={minutes}
        reference={goalOrAverage(goalSeconds, average, minutes)}
      />
    </ChartCard>
  )
}
