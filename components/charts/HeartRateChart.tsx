'use client'

import { LabelList, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

import { colorTokens } from '../../lib/design/tokens'

import { ChartCard, SparseValue } from './ChartCard'
import { AXIS_TICK, END_LABEL_GUTTER, LABEL_HALO } from './chartStyle'
import { dayTick, lastIndex, presentValues, tickDates, trendWord } from './rangeData'

import type { LegendItem, SparsePart } from './ChartCard'
import type { DayPoint, RangeTab } from './rangeData'

export type HeartRateChartProps = {
  days: DayPoint[]
  tab: RangeTab
  className?: string
}

export type HeartRateRow = {
  date: string
  avgHeartRate: number | null
  maxHeartRate: number | null
  avgEnd: string | null
  maxEnd: string | null
}

export function spread(name: string, values: readonly number[]): string {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = low === high ? String(low) : `${String(low)} to ${String(high)}`
  const last = values.at(-1)
  const end = values.length < 2 || last === undefined ? '' : `, ${String(last)} on the last day`

  return `${name} heart rate ${span} bpm, ${trendWord(values)}${end}`
}

export function heartRateSummary(averages: readonly number[], peaks: readonly number[]): string {
  const parts: string[] = []

  if (averages.length > 0) {
    const mean = averages.reduce((total, value) => total + value, 0) / averages.length
    parts.push(`avg ${String(Math.round(mean))}`)
  }

  if (peaks.length > 0) {
    parts.push(`max ${String(Math.max(...peaks))}`)
  }

  return parts.join(' · ')
}

export function heartRateLabel(averages: readonly number[], peaks: readonly number[]): string {
  const parts: string[] = []

  if (averages.length > 0) {
    parts.push(spread('Average', averages))
  }

  if (peaks.length > 0) {
    parts.push(spread('Highest', peaks))
  }

  return `${parts.join('. ')}.`
}

export function heartRateRows(days: readonly DayPoint[]): HeartRateRow[] {
  const lastAverage = lastIndex(days.map((day) => day.avgHeartRate))
  const lastPeak = lastIndex(days.map((day) => day.maxHeartRate))

  return days.map((day, index) => ({
    date: day.date,
    avgHeartRate: day.avgHeartRate,
    maxHeartRate: day.maxHeartRate,
    avgEnd: index === lastAverage ? String(day.avgHeartRate) : null,
    maxEnd: index === lastPeak ? String(day.maxHeartRate) : null,
  }))
}

export function heartRateLegend(
  averages: readonly number[],
  peaks: readonly number[],
): LegendItem[] {
  const legend: LegendItem[] = []

  if (peaks.length >= 2) {
    legend.push({ name: 'Highest', dot: 'bg-danger' })
  }

  if (averages.length >= 2) {
    legend.push({ name: 'Average', dot: 'bg-data-cyan' })
  }

  return legend
}

export function latestReading(days: readonly DayPoint[]): SparsePart[] {
  const day = days.findLast((point) => point.avgHeartRate !== null || point.maxHeartRate !== null)
  const parts: SparsePart[] = []

  if (day?.avgHeartRate != null) {
    parts.push({ value: String(day.avgHeartRate), unit: 'avg' })
  }

  if (day?.maxHeartRate != null) {
    parts.push({ value: String(day.maxHeartRate), unit: 'max' })
  }

  return parts
}

export function HeartRateChart({ days, tab, className }: HeartRateChartProps) {
  const averages = presentValues(days.map((day) => day.avgHeartRate))
  const peaks = presentValues(days.map((day) => day.maxHeartRate))
  const drawAverage = averages.length >= 2
  const drawPeak = peaks.length >= 2

  return (
    <ChartCard
      title="Heart rate"
      summary={heartRateSummary(averages, peaks)}
      empty={averages.length === 0 && peaks.length === 0}
      emptyText="Log an average or a peak heart rate to see the trend."
      label={heartRateLabel(averages, peaks)}
      legend={heartRateLegend(averages, peaks)}
      sparse={drawAverage || drawPeak ? undefined : <SparseValue parts={latestReading(days)} />}
      className={className}
    >
      <ResponsiveContainer width="100%" height={108}>
        <LineChart
          data={heartRateRows(days)}
          accessibilityLayer={false}
          margin={{ top: 8, right: END_LABEL_GUTTER, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="date"
            ticks={tickDates(days, tab)}
            interval={0}
            tickFormatter={(date: string) => dayTick(date, tab)}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            height={22}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
          {drawPeak ? (
            <Line
              dataKey="maxHeartRate"
              stroke={colorTokens.danger}
              strokeWidth={3}
              dot={{ r: 2.5, fill: colorTokens.danger, stroke: colorTokens.danger }}
              pathLength={1}
              connectNulls
              isAnimationActive={false}
            >
              <LabelList
                dataKey="maxEnd"
                position="right"
                fill={colorTokens.danger}
                {...LABEL_HALO}
              />
            </Line>
          ) : null}
          {drawAverage ? (
            <Line
              dataKey="avgHeartRate"
              stroke={colorTokens['data-cyan']}
              strokeWidth={3}
              dot={{ r: 2.5, fill: colorTokens['data-cyan'], stroke: colorTokens['data-cyan'] }}
              pathLength={1}
              connectNulls
              isAnimationActive={false}
            >
              <LabelList
                dataKey="avgEnd"
                position="right"
                fill={colorTokens['data-cyan']}
                {...LABEL_HALO}
              />
            </Line>
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
