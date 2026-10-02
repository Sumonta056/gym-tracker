'use client'

import {
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

import { colorTokens } from '../../lib/design/tokens'
import { caloriesPerMinute } from '../../lib/metrics/caloriesPerMinute'

import { ChartCard, SparseValue } from './ChartCard'
import { END_LABEL_GUTTER, LABEL_HALO, REFERENCE_STROKE } from './chartStyle'
import { AXIS_HEIGHT, BAND_HEIGHT, PLOT_TOP, ReferenceLabel } from './DailyBars'
import { sessionTicks } from './liftData'
import { ONE_SESSION_HINT } from './OneRepMaxChart'
import { trendWord } from './rangeData'
import { SessionAxisTick } from './VolumeLoadChart'

import type { ReferencePlacement } from './DailyBars'
import type { DayPoint } from './rangeData'

export type CaloriesPerMinuteChartProps = {
  days: DayPoint[]
  height?: number
  className?: string
}

export type RatePoint = {
  date: string
  value: number
}

export type RateRow = RatePoint & {
  end: string | null
}

export type RateScale = {
  low: number
  high: number
}

export const LABEL_CLEARANCE = 10

export const REFERENCE_LABEL_ROW = 16

export function formatRate(value: number): string {
  return value.toFixed(1)
}

export function ratePoints(days: readonly DayPoint[]): RatePoint[] {
  const rows = days
    .filter((day) => day.logged)
    .map((day) => ({
      entry_date: day.date,
      gym_seconds: day.gymSeconds,
      calories_burnt: day.calories,
    }))

  return caloriesPerMinute(rows).flatMap((point) =>
    point.value === null ? [] : [{ date: point.date, value: point.value }],
  )
}

export function rateScale(values: readonly number[]): RateScale {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max(0.5, (high - low) * 0.2)

  return { low: low - pad, high: high + pad }
}

export function ratePlacement(
  last: number,
  average: number,
  scale: RateScale,
  height: number,
): ReferencePlacement {
  const plot = height - PLOT_TOP - AXIS_HEIGHT
  const at = (value: number): number =>
    PLOT_TOP + (plot * (scale.high - value)) / (scale.high - scale.low)
  const line = at(average)
  const end = at(last)

  if (end <= line - LABEL_CLEARANCE && line + REFERENCE_LABEL_ROW <= PLOT_TOP + plot) {
    return 'below'
  }

  if (end >= line + LABEL_CLEARANCE) {
    return 'above'
  }

  return 'band'
}

export function rateRows(points: readonly RatePoint[]): RateRow[] {
  return points.map((point, index) => ({
    ...point,
    end: index === points.length - 1 ? formatRate(point.value) : null,
  }))
}

export function rateLabel(values: readonly number[], average: number): string {
  return `Calories per gym minute per session, ${trendWord(values)}: ${values.map(formatRate).join(', ')}. Average ${formatRate(average)}.`
}

export function CaloriesPerMinuteChart({
  days,
  height = 120,
  className,
}: CaloriesPerMinuteChartProps) {
  const points = ratePoints(days)
  const values = points.map((point) => point.value)
  const last = values.at(-1) ?? 0
  const drawn = values.length >= 2
  const average = drawn ? values.reduce((total, value) => total + value, 0) / values.length : 0
  const scale = drawn ? rateScale(values) : { low: 0, high: 1 }
  const placement = drawn ? ratePlacement(last, average, scale, height) : 'above'
  const rows = rateRows(points)
  const dates = new Map(points.map((point) => [point.date, point.date]))

  return (
    <ChartCard
      title="Calories a gym minute"
      summary={`${formatRate(last)} last session`}
      empty={points.length === 0}
      emptyText="Log the gym time and the calories burnt to see the calories a gym minute."
      label={drawn ? rateLabel(values, average) : ''}
      legend={drawn ? [{ name: 'kcal ÷ gym minutes', dot: 'bg-warn' }] : undefined}
      sparse={
        drawn ? undefined : (
          <SparseValue parts={[{ value: formatRate(last), unit: 'kcal a min' }]} />
        )
      }
      sparseHint={ONE_SESSION_HINT}
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={rows}
          accessibilityLayer={false}
          margin={{
            top: placement === 'band' ? PLOT_TOP + BAND_HEIGHT : PLOT_TOP,
            right: END_LABEL_GUTTER,
            bottom: 0,
            left: 0,
          }}
        >
          <XAxis
            dataKey="date"
            ticks={sessionTicks(points.map((point) => point.date))}
            interval={0}
            tick={<SessionAxisTick dates={dates} />}
            axisLine={false}
            tickLine={false}
            height={AXIS_HEIGHT}
            padding={{ left: 22, right: 10 }}
          />
          <YAxis hide domain={[scale.low, scale.high]} />
          <ReferenceLine
            y={average}
            {...REFERENCE_STROKE}
            ifOverflow="visible"
            label={<ReferenceLabel text={`avg ${formatRate(average)}`} placement={placement} />}
          />
          <Line
            dataKey="value"
            stroke={colorTokens.warn}
            strokeWidth={3}
            dot={{ r: 2.5, fill: colorTokens.warn, stroke: colorTokens.warn }}
            pathLength={1}
            isAnimationActive={false}
          >
            <LabelList dataKey="end" position="right" fill={colorTokens.warn} {...LABEL_HALO} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
