'use client'

import {
  Bar,
  BarChart,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

import { colorTokens } from '../../lib/design/tokens'

import {
  AXIS_TICK,
  LABEL_HALO,
  REFERENCE_GUTTER,
  REFERENCE_LABEL,
  REFERENCE_STROKE,
} from './chartStyle'
import { dayTick, highestIndex, tickDates } from './rangeData'

import type { DayPoint, RangeTab } from './rangeData'

export type Reference = {
  value: number
  label: string
}

export type DailyBarsProps = {
  days: DayPoint[]
  dataKey: 'calories' | 'steps' | 'gymSeconds'
  color: string
  tab: RangeTab
  formatValue: (value: number) => string
  reference?: Reference | null
  height?: number
}

export type BarRow = {
  date: string
  value: number | null
  ghost: number | null
  label: string | null
}

export const MAX_BAR_WIDTH = 28

export function barRadius(count: number): number {
  return count > 7 ? 3 : 6
}

export function drawnValue(value: number | null): number | null {
  return value !== null && value > 0 ? value : null
}

export type ReferenceLabelProps = {
  viewBox?: { x?: number; y?: number; width?: number }
  text: string
}

export function ReferenceLabel({ viewBox, text }: ReferenceLabelProps) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) + REFERENCE_GUTTER

  return (
    <text
      className="reference-label"
      x={x}
      y={viewBox?.y ?? 0}
      dy="0.355em"
      textAnchor="end"
      {...REFERENCE_LABEL}
    >
      {text}
    </text>
  )
}

export function barRows(
  days: readonly DayPoint[],
  dataKey: DailyBarsProps['dataKey'],
  tab: RangeTab,
  formatValue: (value: number) => string,
  top: number,
): BarRow[] {
  const values = days.map((day) => drawnValue(day[dataKey]))
  const highest = highestIndex(values)

  return days.map((day, index) => {
    const value = values[index] ?? null
    const labelled = value !== null && (tab !== 'month' || index === highest)

    return {
      date: day.date,
      value,
      ghost: value === null ? top : null,
      label: labelled ? formatValue(value) : null,
    }
  })
}

export function chartTop(
  days: readonly DayPoint[],
  dataKey: DailyBarsProps['dataKey'],
  reference?: Reference | null,
): number {
  const values = days.flatMap((day) => {
    const value = drawnValue(day[dataKey])
    return value === null ? [] : [value]
  })

  return Math.max(1, ...values, reference?.value ?? 0)
}

export function DailyBars({
  days,
  dataKey,
  color,
  tab,
  formatValue,
  reference = null,
  height = 112,
}: DailyBarsProps) {
  const top = chartTop(days, dataKey, reference)
  const rows = barRows(days, dataKey, tab, formatValue, top)
  const radius = barRadius(days.length)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        accessibilityLayer={false}
        barCategoryGap={days.length > 7 ? '33%' : '18%'}
        maxBarSize={MAX_BAR_WIDTH}
        margin={{ top: 18, right: reference === null ? 0 : REFERENCE_GUTTER, bottom: 0, left: 0 }}
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
        />
        <YAxis hide domain={[0, top]} />
        <Bar
          dataKey="ghost"
          stackId="day"
          fill={colorTokens['surface-2']}
          radius={radius}
          isAnimationActive={false}
        />
        <Bar dataKey="value" stackId="day" fill={color} radius={radius} isAnimationActive={false}>
          <LabelList dataKey="label" position="top" fill={colorTokens.text} {...LABEL_HALO} />
        </Bar>
        {reference === null ? null : (
          <ReferenceLine
            y={reference.value}
            {...REFERENCE_STROKE}
            ifOverflow="visible"
            label={<ReferenceLabel text={reference.label} />}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
