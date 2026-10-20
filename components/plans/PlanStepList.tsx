'use client'

import { useEffect, useState } from 'react'

import { getProfile, lastSetFor } from '../../lib/db/repository'
import { planSteps } from '../../lib/plans'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'

import { PlanThumb } from './PlanCard'
import { lastSetText, targetText } from './planText'
import { WatchPill } from './WatchPill'

import type { WorkoutSet } from '../../lib/db/dexie'
import type { Plan, PlanStep } from '../../lib/schema/plan'
import type { UnitSystem } from '../../lib/schema/profile'

export type LastSets = { unit: UnitSystem; sets: Map<string, WorkoutSet> }

export type LastSetSource = (steps: readonly PlanStep[]) => Promise<LastSets>

export const readLastSets: LastSetSource = async (steps) => {
  const [profile, ...sets] = await Promise.all([
    getProfile(),
    ...steps.map((step) => lastSetFor(step.exerciseId)),
  ])
  const found = new Map<string, WorkoutSet>()

  steps.forEach((step, index) => {
    const set = sets[index]
    if (set !== undefined) found.set(step.exerciseId, set)
  })

  return { unit: profile.unit_system, sets: found }
}

function useLastSets(plan: Plan, source: LastSetSource): LastSets | undefined {
  const [last, setLast] = useState<LastSets | undefined>(undefined)

  useEffect(() => {
    let live = true

    source(planSteps(plan)).then(
      (read) => {
        if (live) setLast(read)
      },
      () => {
        if (live) setLast({ unit: 'metric', sets: new Map() })
      },
    )

    return () => {
      live = false
    }
  }, [plan, source])

  return last
}

function stepLine(step: PlanStep, last: LastSets | undefined): string {
  const target = targetText(step.target)

  if (last === undefined) return target

  return `${target} · ${lastSetText(last.sets.get(step.exerciseId), last.unit)}`
}

export type PlanStepListProps = {
  plan: Plan
  source?: LastSetSource
}

export function PlanStepList({ plan, source = readLastSets }: PlanStepListProps) {
  const last = useLastSets(plan, source)
  const starts = plan.groups.map((_, index) =>
    plan.groups.slice(0, index).reduce((total, group) => total + group.steps.length, 0),
  )

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {plan.groups.map((group, groupIndex) => {
        const headingId = `group-${plan.id}-${group.name.toLowerCase().replace(/\W+/g, '-')}`

        return (
          <Card key={group.name} className="min-w-0">
            <section aria-labelledby={headingId}>
              <h2 id={headingId}>
                <MicroLabel>{group.name}</MicroLabel>
              </h2>
              <ol className="mt-2 grid gap-2">
                {group.steps.map((step, index) => {
                  return (
                    <li
                      key={step.slug}
                      className="border-border flex min-h-[52px] items-center gap-3 border-t pt-2"
                    >
                      <span className="text-muted w-[18px] shrink-0 text-xs font-bold">
                        {(starts[groupIndex] ?? 0) + index + 1}
                      </span>
                      <PlanThumb src={step.images.start} />
                      <span className="grid min-w-0 flex-1">
                        <strong className="text-sm font-bold">{step.name}</strong>
                        <span className="text-muted text-xs">{stepLine(step, last)}</span>
                      </span>
                      {step.video === undefined ? null : (
                        <WatchPill name={step.name} video={step.video} />
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          </Card>
        )
      })}
    </div>
  )
}
