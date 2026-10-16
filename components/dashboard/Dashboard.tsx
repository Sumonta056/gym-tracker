'use client'

import { formatDuration } from '../../lib/duration'
import { formatWeight, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { StatCard } from '../ui/StatCard'

import { DashboardHeader } from './DashboardHeader'
import { HeartRateZonesCard } from './HeartRateZonesCard'
import { ImportNotice } from './ImportNotice'
import { NoteCard } from './NoteCard'
import { formatCount } from './summary'
import { TodayHero } from './TodayHero'
import { goalHint, weightGapText } from './todayText'
import { TodayWorkoutCard } from './TodayWorkoutCard'
import { useDashboard } from './useDashboard'
import { WeekTotalsCard } from './WeekTotalsCard'

import type { DashboardSummary } from './summary'
import type { ReactNode } from 'react'

function DashboardBody({ clock }: DashboardProps): ReactNode {
  const state = useDashboard(clock)

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

  return <DashboardView summary={state.summary} />
}

export type DashboardProps = {
  clock?: () => Date
}

export function stepsHint(steps: number, goal: number): string {
  return `${String(Math.round((steps / goal) * 100))}% of ${formatCount(goal)}`
}

export function DashboardView({ summary }: { summary: DashboardSummary }) {
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
      <DashboardHeader date={summary.today} displayName={summary.displayName} />

      <div
        data-testid="dashboard-grid"
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      >
        <TodayHero
          entry={entry}
          gym={summary.gym}
          streak={summary.streak}
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
                  ? 'Burnt today'
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
          <TodayWorkoutCard workouts={summary.workouts} unit={unit} />
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
          today={summary.today}
          sessionsGoal={summary.sessionsGoal}
          className="md:col-span-2 lg:col-span-3"
        />
      </div>
    </>
  )
}

export function Dashboard({ clock }: DashboardProps) {
  return (
    <>
      <ImportNotice />
      <DashboardBody clock={clock} />
    </>
  )
}
