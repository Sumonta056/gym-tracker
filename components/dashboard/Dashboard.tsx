'use client'

import { StatCard } from '../ui/StatCard'

import { DashboardHeader } from './DashboardHeader'
import { HeartRateZonesCard } from './HeartRateZonesCard'
import { formatCount } from './summary'
import { TodayHero } from './TodayHero'
import { useDashboard } from './useDashboard'
import { WeekTotalsCard } from './WeekTotalsCard'

import type { DashboardSummary } from './summary'

export type DashboardProps = {
  clock?: () => Date
}

export function stepsHint(steps: number | null, goal: number): string {
  if (steps === null) {
    return `Goal ${formatCount(goal)}`
  }

  return `${String(Math.round((steps / goal) * 100))}% of ${formatCount(goal)}`
}

export function DashboardView({ summary }: { summary: DashboardSummary }) {
  const steps = summary.entry?.steps ?? null
  const weight = summary.latestWeightKg

  return (
    <>
      <DashboardHeader date={summary.today} displayName={summary.displayName} />

      <div
        data-testid="dashboard-grid"
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      >
        <TodayHero
          entry={summary.entry}
          streak={summary.streak}
          className="md:col-span-2 lg:col-span-3"
        />

        <div className="grid grid-cols-2 gap-3 md:contents">
          <StatCard
            label="Steps"
            value={steps === null ? '—' : formatCount(steps)}
            hint={stepsHint(steps, summary.stepGoal)}
            progress={steps === null ? 0 : steps / summary.stepGoal}
            tone="cyan"
          />
          <StatCard
            label="Weight"
            value={weight === null ? '—' : weight.toFixed(2)}
            unit="kg"
            hint={weight === null ? 'Not logged yet' : 'Latest entry'}
            sparkline={summary.weightTrend.length > 1 ? summary.weightTrend : undefined}
            tone="violet"
          />
        </div>

        <HeartRateZonesCard zones={summary.zones} />

        <WeekTotalsCard totals={summary.week} className="lg:col-span-3" />
      </div>
    </>
  )
}

export function Dashboard({ clock }: DashboardProps) {
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
