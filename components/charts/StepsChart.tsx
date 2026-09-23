'use client'

import { colorTokens } from '../../lib/design/tokens'
import { compactNumber } from '../../lib/format/compactNumber'
import { formatCount } from '../dashboard/summary'

import { ChartCard } from './ChartCard'
import { DailyBars } from './DailyBars'
import { countList, presentValues, sum, trendWord } from './rangeData'

import type { DayPoint, RangeTab } from './rangeData'

export type StepsChartProps = {
  days: DayPoint[]
  tab: RangeTab
  stepGoal: number
  className?: string
}

export function stepsLabel(values: readonly number[], stepGoal: number, tab: RangeTab): string {
  const highest = tab === 'month' ? ` Highest ${formatCount(Math.max(...values))}.` : ''

  const period = tab === 'month' ? ' this month' : ''

  return `Steps per day${period}, ${trendWord(values)}: ${countList(values)}. Total ${formatCount(sum(values))}.${highest} Goal ${formatCount(stepGoal)} a day.`
}

export function StepsChart({ days, tab, stepGoal, className }: StepsChartProps) {
  const values = presentValues(days.map((day) => day.steps))

  return (
    <ChartCard
      title="Steps"
      summary={`${formatCount(sum(values))} total`}
      empty={values.length === 0}
      emptyText="Log your steps to see them per day."
      label={stepsLabel(values, stepGoal, tab)}
      className={className}
    >
      <DailyBars
        days={days}
        dataKey="steps"
        color={colorTokens['data-cyan']}
        tab={tab}
        formatValue={compactNumber}
        reference={{ value: stepGoal, label: `goal ${compactNumber(stepGoal)}` }}
      />
    </ChartCard>
  )
}
