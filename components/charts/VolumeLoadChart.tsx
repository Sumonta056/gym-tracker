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
import { compactNumber } from '../../lib/format/compactNumber'
import { toDisplayWeight, weightSymbol, weightWord } from '../../lib/format/weight'
import { formatCount } from '../dashboard/summary'

import { ChartCard } from './ChartCard'
import { AXIS_TICK, LABEL_HALO, REFERENCE_STROKE } from './chartStyle'
import {
  AXIS_HEIGHT,
  BAND_HEIGHT,
  barRadius,
  MAX_BAR_WIDTH,
  PLOT_TOP,
  ReferenceLabel,
  referencePlacement,
} from './DailyBars'
import { sessionTick, sessionTicks } from './liftData'
import { averagePerLoggedDay, countList, highestIndex, sum, trendWord } from './rangeData'

import type { ReferencePlacement } from './DailyBars'
import type { RangeTab } from './rangeData'
import type { SessionVolume } from '../../lib/metrics/liftTrends'
import type { UnitSystem } from '../../lib/schema/profile'

export type VolumeLoadChartProps = {
  volumes: SessionVolume[]
  weekChange: number | null
  tab: RangeTab
  unit?: UnitSystem
  height?: number
  className?: string
}

export type VolumeRow = {
  id: string
  value: number | null
  ghost: number | null
  label: string | null
}

export const TICK_CHARACTER_WIDTH = 6.5

export type TickPlace = {
  x: number
  anchor: 'start' | 'middle' | 'end'
}

export function tickPlace(x: number, width: number, text: string): TickPlace {
  const half = (text.length * TICK_CHARACTER_WIDTH) / 2

  if (x - half < 0) {
    return { x: 0, anchor: 'start' }
  }

  return x + half > width ? { x: width, anchor: 'end' } : { x, anchor: 'middle' }
}

export type SessionAxisTickProps = {
  dates: ReadonlyMap<string, string>
  x?: number
  y?: number
  width?: number
  payload?: { value?: unknown }
  className?: string
  orientation?: string
}

export function SessionAxisTick({
  dates,
  x = 0,
  y = 0,
  width = 0,
  payload,
  className,
  orientation,
}: SessionAxisTickProps) {
  const id = typeof payload?.value === 'string' ? payload.value : ''
  const text = sessionTick(dates.get(id) ?? '')
  const place = tickPlace(x, width, text)

  return (
    <text
      className={className}
      orientation={orientation}
      x={place.x}
      y={y}
      dy="0.71em"
      textAnchor={place.anchor}
      {...AXIS_TICK}
    >
      {text}
    </text>
  )
}

export function weekChangeText(change: number | null): string {
  if (change === null) {
    return 'No volume last week to compare'
  }

  if (change === 0) {
    return 'Same as last week'
  }

  return change > 0 ? `+${String(change)}% vs last week` : `−${String(-change)}% vs last week`
}

export function weekChangeSentence(change: number | null): string {
  if (change === null) {
    return 'No volume last week to compare.'
  }

  if (change === 0) {
    return 'The same as last week.'
  }

  return change > 0
    ? `Up ${String(change)} percent against last week.`
    : `Down ${String(-change)} percent against last week.`
}

export function volumeLabel(
  values: readonly number[],
  average: number | null,
  change: number | null,
  unit: UnitSystem = 'metric',
): string {
  const trend = values.length < 2 ? 'one session' : trendWord(values)
  const base = `Volume load per session, ${trend}: ${countList(values.map(Math.round))} ${weightWord(unit)}.`
  const mean =
    average === null
      ? ''
      : ` Average ${formatCount(Math.round(average))} ${weightWord(unit)} a session.`

  return `${base}${mean} ${weekChangeSentence(change)}`
}

export function volumeRows(
  volumes: readonly SessionVolume[],
  tab: RangeTab,
  unit: UnitSystem,
  top: number,
): VolumeRow[] {
  const values = volumes.map((item) =>
    item.volume > 0 ? toDisplayWeight(item.volume, unit) : null,
  )
  const highest = highestIndex(values)

  return volumes.map((item, index) => {
    const value = values[index] ?? null
    const labelled = value !== null && (tab !== 'month' || index === highest)

    return {
      id: item.sessionId,
      value,
      ghost: value === null ? top : null,
      label: labelled ? compactNumber(value) : null,
    }
  })
}

export function volumePlacement(
  rows: readonly VolumeRow[],
  top: number,
  average: number,
  height: number,
  tab: RangeTab,
): ReferencePlacement {
  if (tab === 'month') {
    return 'band'
  }

  const placement = referencePlacement(rows, top, average, height)

  return placement === 'below' ? 'band' : placement
}

export const LABEL_BOX_TOP = 15

export const LABEL_BOX_BOTTOM = 2

export const LINE_GAP = 3

function plotY(value: number, top: number, height: number, plotTop: number): number {
  return plotTop + (height - plotTop - AXIS_HEIGHT) * (1 - value / top)
}

export function clearOfLine(
  rows: readonly VolumeRow[],
  average: number,
  top: number,
  height: number,
  plotTop: number,
): VolumeRow[] {
  const line = plotY(average, top, height, plotTop)

  return rows.map((row) => {
    if (row.value === null || row.label === null) {
      return row
    }

    const bar = plotY(row.value, top, height, plotTop)
    const touches =
      line >= bar - LABEL_BOX_TOP - LINE_GAP && line <= bar - LABEL_BOX_BOTTOM + LINE_GAP

    return touches ? { ...row, label: null } : row
  })
}

export function VolumeLoadChart({
  volumes,
  weekChange,
  tab,
  unit = 'metric',
  height = 112,
  className,
}: VolumeLoadChartProps) {
  const values = volumes.flatMap((item) =>
    item.volume > 0 ? [toDisplayWeight(item.volume, unit)] : [],
  )
  const average = averagePerLoggedDay(sum(values), values.length)
  const top = Math.max(1, ...values, average ?? 0)
  const rows = volumeRows(volumes, tab, unit, top)
  const placement = average === null ? null : volumePlacement(rows, top, average, height, tab)
  const plotTop = placement === 'band' ? PLOT_TOP + BAND_HEIGHT : PLOT_TOP
  const drawnRows = average === null ? rows : clearOfLine(rows, average, top, height, plotTop)
  const symbol = weightSymbol(unit)
  const dates = new Map(volumes.map((item) => [item.sessionId, item.date]))
  const radius = barRadius(volumes.length)
  const empty = values.length === 0
  const shown = average ?? values[0] ?? 0

  return (
    <ChartCard
      title="Volume load per session"
      summary={`${average === null ? '' : 'avg '}${formatCount(Math.round(shown))} ${symbol}`}
      empty={empty}
      emptyText="Finish a set with a load to see the volume of each session."
      label={volumeLabel(values, average, weekChange, unit)}
      legend={[{ name: `${symbol} lifted, reps × load`, dot: 'bg-data-cyan' }]}
      lead={
        empty ? undefined : (
          <p
            className={
              weekChange === null
                ? 'text-muted text-[13px]'
                : 'text-data-cyan text-[13px] font-bold'
            }
          >
            {weekChangeText(weekChange)}
          </p>
        )
      }
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={drawnRows}
          accessibilityLayer={false}
          barCategoryGap={volumes.length > 7 ? '33%' : '18%'}
          maxBarSize={MAX_BAR_WIDTH}
          margin={{ top: plotTop, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="id"
            ticks={sessionTicks(rows.map((row) => row.id))}
            interval={0}
            tick={<SessionAxisTick dates={dates} />}
            axisLine={false}
            tickLine={false}
            height={AXIS_HEIGHT}
          />
          <YAxis hide domain={[0, top]} />
          <Bar
            dataKey="ghost"
            stackId="session"
            fill={colorTokens['surface-2']}
            radius={radius}
            isAnimationActive={false}
          />
          <Bar
            dataKey="value"
            stackId="session"
            fill={colorTokens['data-cyan']}
            radius={radius}
            isAnimationActive={false}
          >
            <LabelList dataKey="label" position="top" fill={colorTokens.text} {...LABEL_HALO} />
          </Bar>
          {average === null ? null : (
            <ReferenceLine
              y={average}
              {...REFERENCE_STROKE}
              ifOverflow="visible"
              label={
                <ReferenceLabel
                  text={`avg ${compactNumber(average)}`}
                  placement={placement ?? 'above'}
                />
              }
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
