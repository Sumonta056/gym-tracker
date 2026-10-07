'use client'

import { Fragment } from 'react'

import { cn } from '../ui/cn'

import { ChartCard } from './ChartCard'
import { HEAT_MAP_WEEKS } from './rangeData'

import type { HeatCell, HeatWeek } from './rangeData'
import type { Streak } from '../../lib/metrics/streak'

export type StreakHeatMapProps = {
  weeks: HeatWeek[]
  streak: Streak
  className?: string
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const CELL_CLASS: Record<HeatCell['state'], string> = {
  logged: 'bg-accent',
  missed: 'bg-dim',
  future: 'border border-dashed border-dim',
}

export function cellClass(state: HeatCell['state']): string {
  return CELL_CLASS[state]
}

const GRID_COLUMNS = {
  gridTemplateColumns: `auto repeat(${String(HEAT_MAP_WEEKS)}, minmax(0, 1fr))`,
}

function HeatGrid({ weeks }: { weeks: readonly HeatWeek[] }) {
  return (
    <div className="grid w-full max-w-[440px] items-center gap-[3px]" style={GRID_COLUMNS}>
      {WEEKDAY_LABELS.map((label, weekday) => (
        <Fragment key={label}>
          <span data-weekday-label className="text-muted pr-1.5 text-[11px] leading-none">
            {label}
          </span>
          {weeks.map((week) => {
            const state = week.days[weekday]?.state ?? 'future'

            return (
              <span
                key={week.start}
                data-state={state}
                className={cn('aspect-square rounded-sm', cellClass(state))}
              />
            )
          })}
        </Fragment>
      ))}
    </div>
  )
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
        { name: 'Ahead', dot: 'border border-dim' },
      ]}
      footer={<p className="text-muted text-xs">Each column is a week. Weeks start on Monday.</p>}
      className={className}
    >
      <HeatGrid weeks={weeks} />
    </ChartCard>
  )
}
