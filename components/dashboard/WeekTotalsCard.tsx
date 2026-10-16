import { formatDuration } from '../../lib/duration'
import { weekDates } from '../../lib/metrics/weekTotals'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { StatIcon } from '../ui/StatIcon'
import { plural } from '../workouts/historyText'

import { formatCount, weekRangeLabel } from './summary'

import type { WeekRange, WeekTotals } from '../../lib/metrics/weekTotals'
import type { StatIconName } from '../ui/StatIcon'

export type WeekTotalsCardProps = {
  totals: WeekTotals
  range: WeekRange
  gymDates?: string[]
  today?: string
  sessionsGoal?: number | null
  className?: string
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function goalLine(sessions: number, goal: number | null): string {
  return goal === null
    ? `${plural(sessions, 'session')} this week`
    : `${String(sessions)} of ${plural(goal, 'session')}`
}

export function goalNote(
  sessions: number,
  goal: number | null,
  daysLeft: number | null,
): string | null {
  if (goal === null) {
    return null
  }

  const remaining = goal - sessions

  if (remaining <= 0) {
    return 'Goal reached.'
  }

  const more = `${String(remaining)} more to reach your goal.`

  if (daysLeft === null) {
    return more
  }

  return daysLeft === 0
    ? `${more} This is the last day.`
    : `${more} ${plural(daysLeft, 'day')} left.`
}

function dayName(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

function dayLetter(date: string): string {
  return DAY_LETTERS[new Date(`${date}T00:00:00.000Z`).getUTCDay()] ?? ''
}

export function dayState(date: string, gym: boolean, today: string | undefined): string {
  const parts = [dayName(date), gym ? 'gym day' : 'no gym']

  if (date === today) {
    parts.push('today')
  } else if (today !== undefined && date > today) {
    parts[1] = 'to come'
  }

  return parts.join(', ')
}

function GoalRing({ share }: { share: number }) {
  const filled = Math.min(1, Math.max(0, share)) * 100

  return (
    <svg
      viewBox="0 0 42 42"
      aria-hidden="true"
      focusable="false"
      className="size-16 shrink-0 -rotate-90"
    >
      <circle cx="21" cy="21" r="15.915" fill="none" strokeWidth={5} className="stroke-surface-2" />
      {filled === 0 ? null : (
        <circle
          data-testid="goal-progress"
          cx="21"
          cy="21"
          r="15.915"
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${String(filled)} ${String(100 - filled)}`}
          className="stroke-accent"
        />
      )}
    </svg>
  )
}

function Tile({
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
    <div className="bg-surface-2 flex min-w-0 flex-col gap-2 rounded-2xl p-3">
      <dt className="text-muted flex items-center gap-1.5 text-[11px] font-semibold">
        <StatIcon name={icon} className={tone} />
        {label}
      </dt>
      <dd className="text-text text-[22px] leading-none font-extrabold tracking-[-0.6px] break-words">
        {value}
        {unit === undefined ? null : (
          <span className="text-muted ml-0.5 text-[11px] font-semibold tracking-normal">
            {unit}
          </span>
        )}
      </dd>
    </div>
  )
}

export function WeekTotalsCard({
  totals,
  range,
  gymDates = [],
  today,
  sessionsGoal = null,
  className,
}: WeekTotalsCardProps) {
  const dates = weekDates(range)
  const gym = new Set(gymDates)
  const daysLeft = today === undefined ? null : dates.filter((date) => date > today).length
  const note = goalNote(totals.sessions, sessionsGoal, daysLeft)

  return (
    <Card className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2>
          <MicroLabel>This week</MicroLabel>
        </h2>
        <p className="text-muted text-[13px]">{weekRangeLabel(range)}</p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
        <div className="flex items-center gap-3.5 md:w-72 md:shrink-0">
          {sessionsGoal === null ? null : (
            <div className="relative">
              <GoalRing share={totals.sessions / sessionsGoal} />
              <span
                aria-hidden="true"
                className="text-text absolute inset-0 grid place-items-center text-[15px] font-extrabold"
              >
                {`${String(totals.sessions)}/${String(sessionsGoal)}`}
              </span>
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-text text-lg font-extrabold">
              {goalLine(totals.sessions, sessionsGoal)}
            </p>
            {note === null ? null : <p className="text-muted text-xs">{note}</p>}
          </div>
        </div>

        <ol aria-label="Gym days this week" className="grid flex-1 grid-cols-7 gap-1.5">
          {dates.map((date) => {
            const done = gym.has(date)
            const isToday = date === today
            const future = today !== undefined && date > today

            return (
              <li
                key={date}
                data-date={date}
                className={cn(
                  'flex flex-col items-center gap-1.5 text-[11px] font-semibold',
                  isToday ? 'text-text' : 'text-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid aspect-square w-full max-w-9 place-items-center rounded-xl',
                    done && 'bg-accent text-accent-ink',
                    !done && future && 'border-border border border-dashed',
                    !done && !future && 'bg-surface-2',
                    isToday && 'outline-accent outline-2 outline-offset-2',
                  )}
                >
                  {done ? <StatIcon name="dumbbell" className="size-4" /> : null}
                </span>
                <span aria-hidden="true">{dayLetter(date)}</span>
                <span className="sr-only">{dayState(date, done, today)}</span>
              </li>
            )
          })}
        </ol>
      </div>

      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile
          icon="clock"
          tone="text-accent"
          label="Gym time"
          value={formatDuration(totals.gymSeconds, 'short')}
        />
        <Tile
          icon="flame"
          tone="text-warn"
          label="Calories"
          value={formatCount(totals.calories)}
          unit="kcal"
        />
        <Tile icon="steps" tone="text-data-cyan" label="Steps" value={formatCount(totals.steps)} />
        <Tile
          icon="walk"
          tone="text-data-cyan"
          label="Walk"
          value={formatDuration(totals.walkSeconds, 'short')}
        />
      </dl>
    </Card>
  )
}
