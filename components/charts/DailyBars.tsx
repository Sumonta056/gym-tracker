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

import { AXIS_TICK, LABEL_HALO, REFERENCE_LABEL, REFERENCE_STROKE } from './chartStyle'
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

export type ReferencePlacement = 'above' | 'below' | 'band'

export type ReferenceLabelProps = {
  viewBox?: { x?: number; y?: number; width?: number }
  text: string
  placement?: ReferencePlacement
}

const PLOT_TOP = 18

const AXIS_HEIGHT = 22

const LABEL_BOX = 13

const LABEL_PAD = 3

const VALUE_LABEL_OFFSET = 5

const LABEL_SPAN = 0.22

const BAND_HEIGHT = 14

const BAND_BASELINE = 11

export function ReferenceLabel({ viewBox, text, placement = 'above' }: ReferenceLabelProps) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0)
  const line = viewBox?.y ?? 0
  const below = placement === 'below'
  const y = placement === 'band' ? BAND_BASELINE : below ? line + LABEL_PAD : line - LABEL_PAD

  return (
    <text
      className="reference-label"
      x={x}
      y={y}
      dy={below ? '0.8em' : undefined}
      textAnchor="end"
      {...REFERENCE_LABEL}
      stroke={LABEL_HALO.stroke}
      strokeWidth={LABEL_HALO.strokeWidth}
      strokeLinejoin={LABEL_HALO.strokeLinejoin}
      paintOrder={LABEL_HALO.paintOrder}
    >
      {text}
    </text>
  )
}

type Box = { top: number; bottom: number }

function overlaps(one: Box, other: Box): boolean {
  return one.top < other.bottom && other.top < one.bottom
}

export function referencePlacement(
  rows: readonly { value: number | null; label: string | null }[],
  top: number,
  reference: number,
  height: number,
): ReferencePlacement {
  const plot = height - PLOT_TOP - AXIS_HEIGHT
  const at = (value: number): number => PLOT_TOP + plot * (1 - value / top)
  const line = at(reference)
  const above = { top: line - LABEL_PAD - LABEL_BOX, bottom: line - LABEL_PAD }
  const below = { top: line + LABEL_PAD, bottom: line + LABEL_PAD + LABEL_BOX }
  const under = rows.slice(rows.length - Math.ceil(rows.length * LABEL_SPAN))
  const values = under.flatMap((row) =>
    row.value === null || row.label === null ? [] : [row.value],
  )
  const boxes = values.map((value) => {
    const bottom = at(value) - VALUE_LABEL_OFFSET
    return { top: bottom - LABEL_BOX, bottom }
  })

  if (!boxes.some((box) => overlaps(box, above))) return 'above'

  const fitsBelow = below.bottom <= PLOT_TOP + plot
  const clearBelow = !boxes.some((box) => overlaps(box, below))

  return fitsBelow && clearBelow ? 'below' : 'band'
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
  const placement =
    reference === null ? null : referencePlacement(rows, top, reference.value, height)
  const plotTop = placement === 'band' ? PLOT_TOP + BAND_HEIGHT : PLOT_TOP

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        accessibilityLayer={false}
        barCategoryGap={days.length > 7 ? '33%' : '18%'}
        maxBarSize={MAX_BAR_WIDTH}
        margin={{ top: plotTop, right: 0, bottom: 0, left: 0 }}
      >
        <XAxis
          dataKey="date"
          ticks={tickDates(days, tab)}
          interval={0}
          tickFormatter={(date: string) => dayTick(date, tab)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          height={AXIS_HEIGHT}
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
            label={<ReferenceLabel text={reference.label} placement={placement ?? 'above'} />}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
