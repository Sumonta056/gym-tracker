'use client'

import {
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  usePlotArea,
  XAxis,
  YAxis,
} from 'recharts'

import { colorTokens } from '../../lib/design/tokens'
import { toDisplayWeight, weightSymbol, weightWord } from '../../lib/format/weight'

import { ChartCard, SparseValue } from './ChartCard'
import { AXIS_TICK, END_LABEL_GUTTER, LABEL_HALO, RANGE_TICK, REFERENCE_STROKE } from './chartStyle'
import { BAND_HEIGHT, ReferenceLabel } from './DailyBars'
import {
  dayTick,
  formatKg,
  lastIndex,
  PERIOD_WORD,
  presentValues,
  signedKg,
  tickDates,
  trendWord,
} from './rangeData'

import type { LegendItem } from './ChartCard'
import type { DayPoint, RangeTab } from './rangeData'
import type { UnitSystem } from '../../lib/schema/profile'

export type WeightChartProps = {
  days: DayPoint[]
  tab: RangeTab
  unit?: UnitSystem
  targetKg?: number | null
  className?: string
}

export type WeightRow = {
  date: string
  weightKg: number | null
  averageKg: number | null
  weightEnd: string | null
  averageEnd: string | null
}

export function weightSummary(
  weights: readonly number[],
  tab: RangeTab,
  unit: UnitSystem = 'metric',
): string {
  const first = weights[0]
  const last = weights.at(-1)

  if (first === undefined || last === undefined) {
    return ''
  }

  const latest = `${formatKg(last)} ${weightSymbol(unit)}`

  return weights.length < 2 ? latest : `${latest} · ${signedKg(last - first)} ${PERIOD_WORD[tab]}`
}

export function weightLabel(
  weights: readonly number[],
  averages: readonly number[],
  unit: UnitSystem = 'metric',
  target: number | null = null,
): string {
  const base = `Weight per day: ${weights.map(formatKg).join(', ')} ${weightWord(unit)}.`
  const last = averages.at(-1)
  const trend =
    averages.length < 2 || last === undefined
      ? ''
      : ` Seven day average ${trendWord(averages)}, ${formatKg(last)} on the last day.`
  const goal = target === null ? '' : ` Target ${formatKg(target)} ${weightWord(unit)}.`

  return `${base}${trend}${goal}`
}

function inUnit(value: number | null, unit: UnitSystem): number | null {
  return value === null ? null : toDisplayWeight(value, unit)
}

export function daysInUnit(days: readonly DayPoint[], unit: UnitSystem): DayPoint[] {
  return days.map((day) => ({
    ...day,
    weightKg: inUnit(day.weightKg, unit),
    averageKg: inUnit(day.averageKg, unit),
  }))
}

export function weightRows(days: readonly DayPoint[]): WeightRow[] {
  const lastWeight = lastIndex(days.map((day) => day.weightKg))
  const lastAverage = lastIndex(days.map((day) => day.averageKg))

  return days.map((day, index) => ({
    date: day.date,
    weightKg: day.weightKg,
    averageKg: day.averageKg,
    weightEnd: index === lastWeight && day.weightKg !== null ? formatKg(day.weightKg) : null,
    averageEnd: index === lastAverage && day.averageKg !== null ? formatKg(day.averageKg) : null,
  }))
}

const RANGE_AXIS_WIDTH = 34

const RANGE_AXIS_FITS = 4

const RANGE_AXIS_PER_CHARACTER = 7

export function rangeAxisWidth(labels: readonly string[]): number {
  const longest = Math.max(RANGE_AXIS_FITS, ...labels.map((label) => label.length))

  return RANGE_AXIS_WIDTH + (longest - RANGE_AXIS_FITS) * RANGE_AXIS_PER_CHARACTER
}

export function weightLegend(averages: readonly number[]): LegendItem[] {
  const legend: LegendItem[] = [{ name: 'Weight', dot: 'bg-data-violet/50' }]

  return averages.length < 2
    ? legend
    : [...legend, { name: '7-day average', dot: 'bg-data-violet' }]
}

export type TargetLabelProps = {
  text: string
}

export function TargetLabel({ text }: TargetLabelProps) {
  const area = usePlotArea()

  return area === undefined ? null : (
    <ReferenceLabel viewBox={{ x: area.x, width: area.width }} text={text} placement="band" />
  )
}

export function WeightChart({
  days: stored,
  tab,
  unit = 'metric',
  targetKg = null,
  className,
}: WeightChartProps) {
  const days = daysInUnit(stored, unit)
  const weights = presentValues(days.map((day) => day.weightKg))
  const averages = presentValues(days.map((day) => day.averageKg))
  const latest = weights.at(-1)
  const color = colorTokens['data-violet']
  const drawAverage = averages.length >= 2
  const rangeTicks = [...new Set([Math.min(...weights), Math.max(...weights)])]
  const target = targetKg === null ? null : toDisplayWeight(targetKg, unit)

  return (
    <ChartCard
      title="Weight"
      summary={weightSummary(weights, tab, unit)}
      empty={latest === undefined}
      emptyText="Log a weight to see the trend and its 7-day average."
      label={weightLabel(weights, averages, unit, target)}
      legend={weightLegend(averages)}
      sparse={
        latest !== undefined && weights.length < 2 ? (
          <SparseValue parts={[{ value: formatKg(latest), unit: weightSymbol(unit) }]} />
        ) : undefined
      }
      className={className}
    >
      <ResponsiveContainer width="100%" height={124}>
        <LineChart
          data={weightRows(days)}
          accessibilityLayer={false}
          margin={{
            top: target === null ? 10 : 10 + BAND_HEIGHT,
            right: END_LABEL_GUTTER,
            bottom: 0,
            left: 0,
          }}
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
            padding={{ left: 14, right: 10 }}
          />
          <YAxis
            width={rangeAxisWidth(rangeTicks.map(formatKg))}
            ticks={rangeTicks}
            tickFormatter={formatKg}
            tick={RANGE_TICK}
            axisLine={false}
            tickLine={false}
            domain={['dataMin - 0.2', 'dataMax + 0.2']}
          />
          <Line
            dataKey="weightKg"
            stroke={color}
            strokeOpacity={0.5}
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: color, stroke: color, fillOpacity: 0.5, strokeOpacity: 0.5 }}
            pathLength={1}
            connectNulls
            isAnimationActive={false}
          >
            <LabelList
              dataKey="weightEnd"
              position="right"
              fill={colorTokens.muted}
              {...LABEL_HALO}
            />
          </Line>
          {drawAverage ? (
            <Line
              dataKey="averageKg"
              stroke={color}
              strokeWidth={3}
              dot={false}
              pathLength={1}
              connectNulls
              isAnimationActive={false}
            >
              <LabelList dataKey="averageEnd" position="right" fill={color} {...LABEL_HALO} />
            </Line>
          ) : null}
          {target === null ? null : (
            <>
              <ReferenceLine y={target} {...REFERENCE_STROKE} ifOverflow="discard" />
              <TargetLabel text={`target ${formatKg(target)}`} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
