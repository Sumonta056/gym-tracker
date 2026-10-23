'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import { formatDuration } from '../../lib/duration'
import { logPath, parseLogDate } from '../../lib/format/logDate'
import { formatWeight, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { localDate } from '../../lib/schema/dailyEntry'
import { StatCard } from '../ui/StatCard'

import { DashboardHeader } from './DashboardHeader'
import { HeartRateZonesCard } from './HeartRateZonesCard'
import { ImportNotice } from './ImportNotice'
import { NoteCard } from './NoteCard'
import { formatCount, headerDate } from './summary'
import { TodayHero } from './TodayHero'
import { goalHint, weightGapText } from './todayText'
import { TodayWorkoutCard } from './TodayWorkoutCard'
import { useDashboard } from './useDashboard'
import { WeekTotalsCard } from './WeekTotalsCard'

import type { DashboardSummary } from './summary'
import type { ReactNode } from 'react'

function systemClock(): Date {
  return new Date()
}

function DashboardBody({ clock = systemClock }: DashboardProps): ReactNode {
  const asked = useSearchParams().get('date')
  const today = localDate(clock())
  const date = parseLogDate(asked, today)
  const state = useDashboard(date, clock)

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-muted text-sm">
        Reading this device…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-danger text-sm">
        {state.message}
      </p>
    )
  }

  return <DashboardView summary={state.summary} today={today} />
}

export type DashboardProps = {
  clock?: () => Date
}

export function stepsHint(steps: number, goal: number): string {
  return `${String(Math.round((steps / goal) * 100))}% of ${formatCount(goal)}`
}

export function burntHint(date: string, today: string): string {
  return date === today ? 'Burnt today' : `Burnt on ${headerDate(date).short}`
}

export type DashboardViewProps = {
  summary: DashboardSummary
  today?: string
}

export function DashboardView({ summary, today = summary.today }: DashboardViewProps) {
  const date = summary.today
  const entry = summary.entry
  const steps = entry?.steps ?? null
  const calories = entry?.calories_burnt ?? null
  const walk = entry?.walk_seconds ?? null
  const swim = entry?.swim_seconds ?? null
  const note = entry?.note?.trim() ?? ''
  const weight = summary.latestWeightKg
  const unit = summary.unitSystem
  const digits = unit === 'metric' ? 2 : 1
  const trend = summary.weightTrend.map((kg) => Number(toDisplayWeight(kg, unit).toFixed(digits)))
  const short = (seconds: number) => formatDuration(seconds, 'short')
  const kcal = (value: number) => `${formatCount(value)} kcal`

  return (
    <>
      <DashboardHeader date={date} today={today} />

      <div
        data-testid="dashboard-grid"
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      >
        <TodayHero
          entry={entry}
          gym={summary.gym}
          streak={summary.streak}
          date={date}
          today={today}
          className="md:col-span-2 lg:col-span-3"
        />

        <div className="grid grid-cols-2 gap-3 md:contents [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1">
          {steps === null ? null : (
            <StatCard
              label="Steps"
              value={formatCount(steps)}
              hint={stepsHint(steps, summary.stepGoal)}
              progress={steps / summary.stepGoal}
              tone="cyan"
              icon="steps"
            />
          )}
          {calories === null ? null : (
            <StatCard
              label="Calories"
              value={formatCount(calories)}
              unit="kcal"
              hint={
                summary.calorieGoal === null
                  ? burntHint(date, today)
                  : goalHint(calories, summary.calorieGoal, kcal)
              }
              progress={summary.calorieGoal === null ? undefined : calories / summary.calorieGoal}
              tone="warn"
              icon="flame"
            />
          )}
          {walk === null ? null : (
            <StatCard
              label="Walk"
              value={short(walk)}
              hint={
                summary.walkGoalSeconds === null
                  ? undefined
                  : goalHint(walk, summary.walkGoalSeconds, short)
              }
              progress={
                summary.walkGoalSeconds === null ? undefined : walk / summary.walkGoalSeconds
              }
              tone="cyan"
              icon="walk"
            />
          )}
          {swim === null ? null : (
            <StatCard label="Swim" value={short(swim)} tone="cyan" icon="swim" />
          )}
          {weight === null ? null : (
            <StatCard
              label="Weight"
              value={formatWeight(weight, unit, digits)}
              unit={weightSymbol(unit)}
              hint={
                summary.weightGapKg === null
                  ? 'Latest entry'
                  : weightGapText(summary.weightGapKg, unit)
              }
              sparkline={trend.length > 1 ? trend : undefined}
              tone="violet"
              icon="scale"
            />
          )}
        </div>

        {summary.workouts.length === 0 ? null : (
          <TodayWorkoutCard workouts={summary.workouts} unit={unit} date={date} today={today} />
        )}
        {note === '' ? null : <NoteCard note={note} />}

        <HeartRateZonesCard
          zones={summary.zones}
          maxHeartRate={summary.maxHeartRate}
          avgBpm={entry?.avg_heart_rate ?? null}
          peakBpm={entry?.max_heart_rate ?? null}
        />

        <WeekTotalsCard
          totals={summary.week}
          range={summary.weekRange}
          gymDates={summary.weekGymDates}
          today={today}
          marked={date}
          sessionsGoal={summary.sessionsGoal}
          className="md:col-span-2 lg:col-span-3"
        />
      </div>

      {date === today ? null : (
        <Link
          href={logPath(date)}
          className="bg-surface-2 border-border text-text rounded-input mt-4 inline-flex min-h-[54px] w-full items-center justify-center gap-2 border px-4 text-[15px] font-bold tracking-[-0.2px] md:max-w-sm"
        >
          Edit this day
        </Link>
      )}
    </>
  )
}

export function Dashboard({ clock }: DashboardProps) {
  return (
    <>
      <ImportNotice />
      <Suspense fallback={null}>
        <DashboardBody clock={clock} />
      </Suspense>
    </>
  )
}
