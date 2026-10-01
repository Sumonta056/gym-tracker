'use client'

import { useId, useState } from 'react'
import { LabelList, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

import { colorTokens } from '../../lib/design/tokens'
import { toDisplayWeight, weightSymbol, weightWord } from '../../lib/format/weight'
import { cn } from '../ui/cn'

import { ChartCard } from './ChartCard'
import { END_LABEL_GUTTER, LABEL_HALO } from './chartStyle'
import { AXIS_HEIGHT } from './DailyBars'
import { MAX_PICKED, pickedCount, sessionTicks, shownPicked, togglePicked } from './liftData'
import { formatKg, lastIndex, trendWord } from './rangeData'
import { SessionAxisTick } from './VolumeLoadChart'

import type { LegendItem } from './ChartCard'
import type { LiftOption, PickSlots, SessionSlot } from './liftData'
import type { UnitSystem } from '../../lib/schema/profile'

export type OneRepMaxChartProps = {
  sessions: SessionSlot[]
  options: LiftOption[]
  unit?: UnitSystem
  className?: string
}

export const SERIES_COLORS = [
  { stroke: colorTokens.accent, dot: 'bg-accent' },
  { stroke: colorTokens['data-cyan'], dot: 'bg-data-cyan' },
  { stroke: colorTokens['data-violet'], dot: 'bg-data-violet' },
] as const

export type Series = {
  id: string
  name: string
  key: string
  endKey: string
  stroke: string
  dot: string
  values: (number | null)[]
}

export type OneRepMaxRow = Record<string, string | number | null>

export function buildSeries(
  slots: readonly SessionSlot[],
  options: readonly LiftOption[],
  picked: readonly (string | null)[],
  unit: UnitSystem,
): { slots: SessionSlot[]; series: Series[] } {
  const byId = new Map(options.map((option) => [option.id, option]))
  const chosen = picked.flatMap((id, index) => {
    const option = id === null ? undefined : byId.get(id)
    return option === undefined ? [] : [{ option, index }]
  })
  const used = slots.filter((slot) => chosen.some(({ option }) => slot.id in option.points))
  const series = chosen.map(({ option, index }): Series => {
    const color = SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0]

    return {
      id: option.id,
      name: option.name,
      key: `v${String(index)}`,
      endKey: `e${String(index)}`,
      stroke: color.stroke,
      dot: color.dot,
      values: used.map((slot) => {
        const value = option.points[slot.id]
        return value === undefined ? null : toDisplayWeight(value, unit)
      }),
    }
  })

  return { slots: used, series }
}

export function presentOf(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null)
}

export function drawnSeries(series: readonly Series[]): Series[] {
  return series.filter((item) => presentOf(item.values).length >= 2)
}

export function oneRepMaxRows(
  slots: readonly SessionSlot[],
  series: readonly Series[],
): OneRepMaxRow[] {
  const ends = series.map((item) => lastIndex(item.values))
  const rows: OneRepMaxRow[] = []

  slots.forEach((slot, row) => {
    if (series.every((item) => (item.values[row] ?? null) === null)) {
      return
    }

    const fields: OneRepMaxRow = { id: slot.id }

    series.forEach((item, index) => {
      const value = item.values[row] ?? null
      fields[item.key] = value
      fields[item.endKey] = row === ends[index] && value !== null ? formatKg(value) : null
    })

    rows.push(fields)
  })

  return rows
}

export function oneRepMaxLabel(series: readonly Series[], unit: UnitSystem = 'metric'): string {
  const parts = series.map((item) => {
    const values = presentOf(item.values)
    const first = values[0] ?? 0
    const last = values.at(-1) ?? 0

    return `${item.name} ${trendWord(values)} from ${formatKg(first)} to ${formatKg(last)} ${weightWord(unit)}.`
  })

  return ['Estimated one-rep max per session.', ...parts].join(' ')
}

export function LiftSparse({ series, symbol }: { series: readonly Series[]; symbol: string }) {
  return (
    <>
      {series.map((item) => (
        <span key={item.id} className="block">
          {formatKg(presentOf(item.values).at(-1) ?? 0)}
          <span className="text-muted text-sm font-semibold tracking-normal">{` ${symbol} · ${item.name}`}</span>
        </span>
      ))}
    </>
  )
}

export type LiftPickerProps = {
  options: LiftOption[]
  picked: (string | null)[]
  onToggle: (id: string) => void
}

export const PICK_LIMIT_HINT = `Up to ${String(MAX_PICKED)} at once. Clear one to pick another.`

export const ONE_SESSION_HINT = 'Log one more session to see a trend.'

export function LiftPicker({ options, picked, onToggle }: LiftPickerProps) {
  const hintId = useId()
  const full = pickedCount(picked) >= MAX_PICKED
  const limited = full && options.length > MAX_PICKED

  return (
    <div>
      <div
        role="group"
        aria-label={`Exercises on the chart, up to ${String(MAX_PICKED)}`}
        aria-describedby={hintId}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => {
          const pressed = picked.includes(option.id)

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={pressed}
              disabled={!pressed && full}
              onClick={() => {
                onToggle(option.id)
              }}
              className={cn(
                'min-h-11 rounded-full border px-4 text-[13px] font-bold disabled:opacity-50',
                pressed
                  ? 'bg-accent border-accent text-accent-ink'
                  : 'bg-surface-2 border-border text-muted',
              )}
            >
              {option.name}
            </button>
          )
        })}
      </div>
      <p
        id={hintId}
        role="status"
        className={cn('text-muted text-xs', limited ? 'mt-2' : undefined)}
      >
        {limited ? PICK_LIMIT_HINT : ''}
      </p>
    </div>
  )
}

export function singleSessionNote(series: readonly Series[], symbol: string): string | null {
  const lone = series.filter((item) => presentOf(item.values).length === 1)

  if (lone.length === 0) {
    return null
  }

  const parts = lone.map(
    (item) => `${item.name}: one session, ${formatKg(presentOf(item.values)[0] ?? 0)} ${symbol}.`,
  )

  return `${parts.join(' ')} ${ONE_SESSION_HINT}`
}

export function OneRepMaxChart({
  sessions,
  options,
  unit = 'metric',
  className,
}: OneRepMaxChartProps) {
  const [picked, setPicked] = useState<PickSlots | null>(null)
  const shown = shownPicked(options, picked)
  const { slots, series } = buildSeries(sessions, options, shown, unit)
  const drawn = drawnSeries(series)
  const symbol = weightSymbol(unit)
  const dates = new Map(slots.map((slot) => [slot.id, slot.date]))
  const rows = oneRepMaxRows(slots, drawn)
  const legend: LegendItem[] = drawn.map((item) => ({ name: item.name, dot: item.dot }))
  const nothingPicked = options.length > 0 && pickedCount(shown) === 0
  const note = drawn.length === 0 ? null : singleSessionNote(series, symbol)

  return (
    <ChartCard
      title="Estimated one-rep max"
      summary="Epley"
      empty={options.length === 0 || nothingPicked}
      emptyText={
        nothingPicked
          ? 'Pick an exercise to see its trend.'
          : 'Finish a set with a load to see the one-rep max trend.'
      }
      label={oneRepMaxLabel(drawn, unit)}
      legend={legend}
      lead={
        options.length === 0 ? undefined : (
          <LiftPicker
            options={options}
            picked={shown}
            onToggle={(id) => {
              setPicked(togglePicked(shown, id))
            }}
          />
        )
      }
      sparse={
        drawn.length === 0 && series.length > 0 ? (
          <LiftSparse series={series} symbol={symbol} />
        ) : undefined
      }
      sparseHint={ONE_SESSION_HINT}
      footer={note === null ? undefined : <p className="text-muted text-xs">{note}</p>}
      className={className}
    >
      <ResponsiveContainer width="100%" height={120}>
        <LineChart
          data={rows}
          accessibilityLayer={false}
          margin={{ top: 10, right: END_LABEL_GUTTER, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="id"
            ticks={sessionTicks(rows.map((row) => String(row.id)))}
            interval={0}
            tick={<SessionAxisTick dates={dates} />}
            axisLine={false}
            tickLine={false}
            height={AXIS_HEIGHT}
            padding={{ left: 22, right: 10 }}
          />
          <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
          {drawn.map((item) => (
            <Line
              key={item.id}
              dataKey={item.key}
              stroke={item.stroke}
              strokeWidth={3}
              dot={{ r: 2.5, fill: item.stroke, stroke: item.stroke }}
              pathLength={1}
              connectNulls
              isAnimationActive={false}
            >
              <LabelList
                dataKey={item.endKey}
                position="right"
                fill={item.stroke}
                {...LABEL_HALO}
              />
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
