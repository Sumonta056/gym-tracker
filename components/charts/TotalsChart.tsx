'use client'

import { colorTokens } from '../../lib/design/tokens'
import { formatDuration } from '../../lib/duration'
import { formatCount } from '../dashboard/summary'

import { ChartCard } from './ChartCard'
import { DailyBars } from './DailyBars'
import { averagePerLoggedDay, loggedDays, PERIOD_WORD } from './rangeData'

import type { DayPoint, RangeTab } from './rangeData'
import type { WeekTotals } from '../../lib/metrics/weekTotals'

export type TotalsChartProps = {
  days: DayPoint[]
  totals: WeekTotals
  tab: RangeTab
  className?: string
}

export const TOTALS_TITLE: Record<RangeTab, string> = {
  day: 'Day totals',
  week: 'Week totals',
  month: 'Month totals',
}

export function totalCells(totals: WeekTotals): { label: string; value: string }[] {
  return [
    { label: 'sessions', value: String(totals.sessions) },
    { label: 'gym time', value: formatDuration(totals.gymSeconds, 'short') },
    { label: 'kcal', value: formatCount(totals.calories) },
    { label: 'steps', value: formatCount(totals.steps) },
  ]
}

export function isEmptyTotals(totals: WeekTotals): boolean {
  return (
    totals.sessions === 0 &&
    totals.gymSeconds === 0 &&
    totals.walkSeconds === 0 &&
    totals.calories === 0 &&
    totals.steps === 0
  )
}

export function spokenCells(totals: WeekTotals): string[] {
  return [
    `${String(totals.sessions)} ${totals.sessions === 1 ? 'session' : 'sessions'}`,
    `${formatDuration(totals.gymSeconds, 'short')} in the gym`,
    `${formatCount(totals.calories)} kcal`,
    `${formatCount(totals.steps)} steps`,
  ]
}

export function minutes(seconds: number): string {
  return formatDuration(seconds, 'minutes')
}

export function totalsLabel(
  totals: WeekTotals,
  tab: RangeTab,
  average: number | null = null,
): string {
  const cells = spokenCells(totals)
  const base = `Time in the gym per day ${PERIOD_WORD[tab]}. Totals: ${cells.join(', ')}.`

  return average === null ? base : `${base} Average ${minutes(average)} a logged day.`
}

export function TotalsChart({ days, totals, tab, className }: TotalsChartProps) {
  const average = averagePerLoggedDay(totals.gymSeconds, loggedDays(days))

  return (
    <ChartCard
      title={TOTALS_TITLE[tab]}
      summary="Gym time per day"
      empty={isEmptyTotals(totals)}
      emptyText={`Nothing logged ${PERIOD_WORD[tab]} yet.`}
      label={totalsLabel(totals, tab, average)}
      footer={
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 lg:grid-cols-4">
          {totalCells(totals).map((cell) => (
            <div key={cell.label} className="flex min-w-0 flex-col-reverse">
              <dt className="text-muted text-xs">{cell.label}</dt>
              <dd className="text-text text-[19px] leading-tight font-bold tracking-[-0.6px] break-words">
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>
      }
      className={className}
    >
      <DailyBars
        days={days}
        dataKey="gymSeconds"
        color={colorTokens.accent}
        tab={tab}
        formatValue={minutes}
        reference={
          average === null || average === 0
            ? null
            : { value: average, label: `avg ${minutes(average)}` }
        }
      />
    </ChartCard>
  )
}
