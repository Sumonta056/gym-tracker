'use client'

import { Bar, BarChart, Rectangle, ResponsiveContainer, XAxis, YAxis } from 'recharts'

import { colorTokens } from '../../lib/design/tokens'

import { ChartCard } from './ChartCard'
import { HEAT_MAP_WEEKS } from './rangeData'

import type { HeatCell, HeatWeek } from './rangeData'
import type { Streak } from '../../lib/metrics/streak'
import type { BarShapeProps } from 'recharts'

export type StreakHeatMapProps = {
  weeks: HeatWeek[]
  streak: Streak
  className?: string
}

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

const CELL_FILL: Record<HeatCell['state'], string> = {
  logged: colorTokens.accent,
  missed: colorTokens.dim,
  future: colorTokens.surface,
}

export function cellFill(weeks: readonly HeatWeek[], week: number, weekday: number): string {
  return CELL_FILL[weeks[week]?.days[weekday]?.state ?? 'future']
}

export function days(count: number): string {
  return count === 1 ? '1 day' : `${String(count)} days`
}

export function heatMapLabel(weeks: readonly HeatWeek[], streak: Streak): string {
  const cells = weeks.flatMap((week) => week.days).filter((cell) => cell.state !== 'future')
  const logged = cells.filter((cell) => cell.state === 'logged').length

  return `Streak over the last ${String(HEAT_MAP_WEEKS)} weeks: logged ${String(logged)} of ${String(cells.length)} days. Current streak ${days(streak.current)}, longest ${days(streak.longest)}.`
}

export function StreakHeatMap({ weeks, streak, className }: StreakHeatMapProps) {
  const logged = weeks.some((week) => week.days.some((cell) => cell.state === 'logged'))
  const rows = weeks.map((week) => ({
    start: week.start,
    d0: 1,
    d1: 1,
    d2: 1,
    d3: 1,
    d4: 1,
    d5: 1,
    d6: 1,
  }))

  return (
    <ChartCard
      title="Streak"
      summary={`${days(streak.current)} · longest ${days(streak.longest)}`}
      empty={!logged}
      emptyText="Log a day to start a streak."
      label={heatMapLabel(weeks, streak)}
      legend={[
        { name: 'Logged', dot: 'bg-accent' },
        { name: 'Not logged', dot: 'bg-dim' },
      ]}
      footer={<p className="text-muted text-xs">Each column is a week, Monday at the top.</p>}
      className={className}
    >
      <ResponsiveContainer width="100%" height={140}>
        <BarChart
          data={rows}
          accessibilityLayer={false}
          barCategoryGap={2}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis dataKey="start" hide />
          <YAxis hide reversed domain={[0, WEEKDAYS.length]} />
          {WEEKDAYS.map((weekday) => (
            <Bar
              key={weekday}
              dataKey={`d${String(weekday)}`}
              stackId="week"
              stroke={colorTokens.surface}
              strokeWidth={2}
              radius={3}
              isAnimationActive={false}
              shape={(props: BarShapeProps) => (
                <Rectangle {...props} fill={cellFill(weeks, props.index, weekday)} />
              )}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
