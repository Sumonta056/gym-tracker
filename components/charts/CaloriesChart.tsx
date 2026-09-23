'use client'

import { colorTokens } from '../../lib/design/tokens'
import { compactNumber } from '../../lib/format/compactNumber'
import { formatCount } from '../dashboard/summary'

import { ChartCard } from './ChartCard'
import { DailyBars } from './DailyBars'
import {
  averagePerLoggedDay,
  countList,
  loggedDays,
  presentValues,
  sum,
  trendWord,
} from './rangeData'

import type { DayPoint, RangeTab } from './rangeData'

export type CaloriesChartProps = {
  days: DayPoint[]
  tab: RangeTab
  className?: string
}

export function caloriesLabel(values: readonly number[], average: number | null): string {
  const base = `Calories per day, ${trendWord(values)}: ${countList(values)} kcal. Total ${formatCount(sum(values))} kcal.`

  return average === null ? base : `${base} Average ${formatCount(Math.round(average))} kcal a day.`
}

export function CaloriesChart({ days, tab, className }: CaloriesChartProps) {
  const values = presentValues(days.map((day) => day.calories))
  const average = averagePerLoggedDay(sum(values), loggedDays(days))

  return (
    <ChartCard
      title="Calories burnt"
      summary={`${formatCount(sum(values))} total`}
      empty={values.length === 0}
      emptyText="Log the calories burnt to see them per day."
      label={caloriesLabel(values, average)}
      className={className}
    >
      <DailyBars
        days={days}
        dataKey="calories"
        color={colorTokens.warn}
        tab={tab}
        formatValue={compactNumber}
        reference={
          average === null ? null : { value: average, label: `avg ${compactNumber(average)}` }
        }
      />
    </ChartCard>
  )
}
