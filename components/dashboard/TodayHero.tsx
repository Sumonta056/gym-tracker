import Link from 'next/link'

import { formatDuration } from '../../lib/duration'
import { LOG_PATH, logPath } from '../../lib/format/logDate'
import { CountUp } from '../motion/CountUp'
import { HeroCard } from '../ui/HeroCard'
import { MicroLabel } from '../ui/MicroLabel'

import { formatCount, headerDate } from './summary'

import type { TodayGym } from './summary'
import type { DailyEntry } from '../../lib/db/dexie'

export type TodayHeroProps = {
  entry: DailyEntry | undefined
  gym: TodayGym
  streak: number
  date: string
  today: string
  name?: string
  className?: string
}

export type HeroWords = {
  label: string
  empty: string
  logLink: string
  noGym: string
}

export function heroWords(date: string, today: string): HeroWords {
  if (date === today) {
    return {
      label: 'Gym time today',
      empty: 'Nothing logged yet today.',
      logLink: 'Log the day',
      noGym: 'No gym time today',
    }
  }

  const { short } = headerDate(date)

  return {
    label: `Gym time · ${short}`,
    empty: `Nothing logged on ${short}.`,
    logLink: 'Log this day',
    noGym: `No gym time on ${short}`,
  }
}

export function streakLabel(days: number): string {
  return `${String(days)} day streak`
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

function Inline({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return null
  }

  return (
    <div className="min-w-0">
      <MicroLabel tone="accent-ink" as="p">
        {label}
      </MicroLabel>
      <p className="text-lg leading-tight font-bold">{formatCount(value)}</p>
    </div>
  )
}

function clock(seconds: number): string {
  return formatDuration(seconds, 'clock')
}

export function TodayHero({ entry, gym, streak, date, today, name, className }: TodayHeroProps) {
  const avg = entry?.avg_heart_rate ?? null
  const peak = entry?.max_heart_rate ?? null
  const words = heroWords(date, today)
  const label = name ?? (date === today ? 'Today' : headerDate(date).dayMonth)

  return (
    <HeroCard aria-label={label} className={className}>
      <div className="flex items-center justify-between gap-3">
        <MicroLabel tone="accent-ink">{words.label}</MicroLabel>
        <StreakPill days={streak} />
      </div>

      {entry === undefined && gym.source === 'none' ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-[23px] leading-tight font-bold tracking-[-0.6px]">{words.empty}</p>
          <p className="text-accent-ink/80 text-sm font-semibold">
            Log the day to see your gym time, heart rate and totals here.
          </p>
          <Link
            href={date === today ? LOG_PATH : logPath(date)}
            className="bg-accent-ink text-accent rounded-input focus-visible:outline-accent-ink inline-flex min-h-11 items-center justify-center self-start px-5 text-[15px] font-bold"
          >
            {words.logLink}
          </Link>
        </div>
      ) : (
        <>
          {gym.source === 'none' ? (
            <p className="mt-2.5 mb-1.5 text-[23px] leading-tight font-bold tracking-[-0.6px]">
              {words.noGym}
            </p>
          ) : (
            <p className="mt-2.5 mb-1.5 text-[48px] leading-none font-extrabold tracking-[-2.4px]">
              <CountUp value={gym.seconds} format={clock} />
            </p>
          )}
          {gym.source === 'sessions' ? (
            <p className="text-accent-ink/80 text-[13px] font-semibold">From your sessions</p>
          ) : null}
          {avg === null && peak === null ? null : (
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              <Inline label="Avg HR" value={avg} />
              <Inline label="Peak" value={peak} />
            </div>
          )}
        </>
      )}
    </HeroCard>
  )
}
