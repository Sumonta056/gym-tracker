import Link from 'next/link'

import { formatDuration } from '../../lib/duration'
import { CountUp } from '../motion/CountUp'
import { HeroCard } from '../ui/HeroCard'
import { MicroLabel } from '../ui/MicroLabel'

import { formatCount } from './summary'

import type { DailyEntry } from '../../lib/db/dexie'

export type TodayHeroProps = {
  entry: DailyEntry | undefined
  streak: number
  name?: string
  className?: string
}

export function streakLabel(days: number): string {
  return `${String(days)} day streak`
}

function Missing() {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">not logged</span>
    </>
  )
}

function StreakPill({ days }: { days: number }) {
  return (
    <span className="bg-accent-ink/15 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        className="size-3 fill-none stroke-current"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2c1 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 2 2 2 0 0-2-1-4 0-5z" />
      </svg>
      {streakLabel(days)}
    </span>
  )
}

function Inline({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <MicroLabel tone="accent-ink" as="p">
        {label}
      </MicroLabel>
      <p className="text-lg leading-tight font-bold">{value ?? <Missing />}</p>
    </div>
  )
}

function countOrNull(value: number | null): string | null {
  return value === null ? null : formatCount(value)
}

function clock(seconds: number): string {
  return formatDuration(seconds, 'clock')
}

function clockOrNull(seconds: number | null): string | null {
  return seconds === null ? null : clock(seconds)
}

export function TodayHero({ entry, streak, name = 'Today', className }: TodayHeroProps) {
  return (
    <HeroCard aria-label={name} className={className}>
      <div className="flex items-center justify-between gap-3">
        <MicroLabel tone="accent-ink">Gym time today</MicroLabel>
        <StreakPill days={streak} />
      </div>

      {entry === undefined ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-[23px] leading-tight font-bold tracking-[-0.6px]">
            Nothing logged yet today.
          </p>
          <p className="text-accent-ink/80 text-sm font-semibold">
            Log the day to see your gym time, heart rate and totals here.
          </p>
          <Link
            href="/log"
            className="bg-accent-ink text-accent rounded-input focus-visible:outline-accent-ink inline-flex min-h-11 items-center justify-center self-start px-5 text-[15px] font-bold"
          >
            Log the day
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2.5 mb-1.5 text-[48px] leading-none font-extrabold tracking-[-2.4px]">
            {entry.gym_seconds === null ? (
              <Missing />
            ) : (
              <CountUp value={entry.gym_seconds} format={clock} />
            )}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4 md:gap-5">
            <Inline label="Avg HR" value={countOrNull(entry.avg_heart_rate)} />
            <Inline label="Peak" value={countOrNull(entry.max_heart_rate)} />
            <Inline label="Kcal" value={countOrNull(entry.calories_burnt)} />
            <Inline label="Walk" value={clockOrNull(entry.walk_seconds)} />
          </div>
        </>
      )}
    </HeroCard>
  )
}
