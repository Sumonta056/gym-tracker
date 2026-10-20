import Link from 'next/link'

import { formatDuration } from '../../lib/duration'
import { toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { dayTotals } from '../../lib/metrics/sessionStats'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { StatIcon } from '../ui/StatIcon'
import { startedText } from '../workout/SessionTimer'
import { plural, sessionPath, volumeDisplay } from '../workouts/historyText'

import { formatCount, headerDate } from './summary'

import type { TodayWorkout } from './summary'
import type { SessionStats } from '../../lib/metrics/sessionStats'
import type { UnitSystem } from '../../lib/schema/profile'
import type { StatIconName } from '../ui/StatIcon'
import type { ReactNode } from 'react'

export type TodayWorkoutCardProps = {
  workouts: TodayWorkout[]
  unit: UnitSystem
  date: string
  today: string
  className?: string
}

export function workoutTitle(date: string, today: string): string {
  return date === today ? 'Workout today' : `Workout · ${headerDate(date).short}`
}

export function sessionDetail(stats: SessionStats, unit: UnitSystem): string {
  if (stats.setCount === 0) {
    return 'No sets logged'
  }

  return [
    plural(stats.exerciseCount, 'exercise'),
    plural(stats.setCount, 'set'),
    volumeDisplay(stats.volumeKg, unit),
    formatDuration(stats.durationSeconds, 'short'),
  ].join(' · ')
}

function Total({
  icon,
  tone,
  label,
  value,
  unit,
}: {
  icon: StatIconName
  tone: string
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="bg-surface-2 flex min-w-0 flex-col gap-1.5 rounded-2xl px-3 py-2.5">
      <span className="text-muted flex items-center gap-1.5 text-[11px] font-semibold">
        <StatIcon name={icon} className={tone} />
        {label}
      </span>
      <span className="text-text text-xl leading-none font-extrabold tracking-[-0.5px]">
        {value}
        {unit === undefined ? null : (
          <span className="text-muted ml-0.5 text-[11px] font-semibold tracking-normal">
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function TodayWorkoutCard({
  workouts,
  unit,
  date,
  today,
  className,
}: TodayWorkoutCardProps) {
  const totals = dayTotals(workouts.map(({ stats }) => stats))
  const newestFirst = [...workouts].sort((a, b) =>
    b.session.started_at.localeCompare(a.session.started_at),
  )

  return (
    <Card className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2>
          <MicroLabel>{workoutTitle(date, today)}</MicroLabel>
        </h2>
        <span className="bg-surface-2 text-text rounded-full px-2.5 py-1 text-xs font-semibold">
          {plural(workouts.length, 'session')}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Total
          icon="clock"
          tone="text-accent"
          label="Time"
          value={formatDuration(totals.durationSeconds, 'short')}
        />
        <Total icon="layers" tone="text-data-cyan" label="Sets" value={String(totals.setCount)} />
        <Total
          icon="kettlebell"
          tone="text-data-violet"
          label="Volume"
          value={formatCount(Math.round(toDisplayWeight(totals.volumeKg, unit)))}
          unit={weightSymbol(unit)}
        />
      </div>

      <ul className="flex flex-col gap-2">
        {newestFirst.map(({ session, stats }) => {
          const empty = stats.setCount === 0
          const records = stats.newRecords.length
          const live = session.status === 'active'

          return (
            <li key={session.id}>
              <Link
                href={sessionPath(session.id)}
                className="border-border hover:bg-surface-2 grid min-h-14 w-full grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl border py-2 pr-2.5 pl-2 text-left"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-10 place-items-center rounded-xl',
                    empty ? 'bg-surface-2 text-dim' : 'bg-accent/12 text-accent',
                  )}
                >
                  <StatIcon name="dumbbell" className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn('text-[15px] font-bold', empty ? 'text-muted' : 'text-text')}
                    >
                      {startedText(session.started_at)}
                    </span>
                    {live ? (
                      <Badge className="text-ok">
                        <span aria-hidden="true" className="bg-ok size-1.5 rounded-full" />
                        In progress
                      </Badge>
                    ) : null}
                    {records === 0 ? null : (
                      <Badge className="bg-accent text-accent-ink">
                        <StatIcon name="trophy" className="size-3" />
                        {`${String(records)} record${records === 1 ? '' : 's'}`}
                      </Badge>
                    )}
                  </span>
                  <span className="text-muted text-xs break-words">
                    {sessionDetail(stats, unit)}
                  </span>
                </span>
                <StatIcon name="chevron" className="text-dim size-4" />
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
