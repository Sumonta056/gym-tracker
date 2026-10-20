'use client'

import { useEffect, useState } from 'react'

import { listPlanHistory } from '../../lib/db/repository'
import { lastDoneByPlan, suggestPlan } from '../../lib/metrics/planSuggestion'
import { listPlans } from '../../lib/plans'
import { localDate } from '../../lib/schema/dailyEntry'

import { PlanCard } from './PlanCard'
import { PlanStartBar } from './PlanStartBar'
import { MISSED_DAY_NOTE, START_BAR_CLASS, toggleSelection } from './planText'
import { SuggestedPlanHero } from './SuggestedPlanHero'

import type { PlanStartSource } from './PlanStartBar'
import type { WorkoutSession } from '../../lib/db/dexie'
import type { Plan, PlanId } from '../../lib/schema/plan'

type Picker = {
  plans: Plan[]
  lastDone: Partial<Record<PlanId, string>>
  suggested: PlanId | undefined
}

export type PlanPickerProps = {
  history?: () => Promise<WorkoutSession[]>
  today?: string
  startSource?: PlanStartSource
}

function readPicker(sessions: WorkoutSession[]): Picker {
  const plans = listPlans()

  return {
    plans,
    lastDone: lastDoneByPlan(sessions),
    suggested: suggestPlan(plans, sessions),
  }
}

export function PlanPicker({ history = listPlanHistory, today, startSource }: PlanPickerProps) {
  const [picker, setPicker] = useState<Picker | undefined>(undefined)
  const [selection, setSelection] = useState<PlanId[]>([])
  const day = today ?? localDate()

  useEffect(() => {
    let live = true

    const show = (sessions: WorkoutSession[]) => {
      if (!live) return
      const read = readPicker(sessions)
      setPicker(read)
      setSelection(read.suggested === undefined ? [] : [read.suggested])
    }

    history().then(show, () => {
      show([])
    })

    return () => {
      live = false
    }
  }, [history])

  if (picker === undefined) {
    return null
  }

  const suggested = picker.plans.find((plan) => plan.id === picker.suggested)
  const chosen = selection.flatMap((id) => picker.plans.filter((plan) => plan.id === id))

  return (
    <div className="mt-5 flex flex-col gap-3">
      {suggested === undefined ? null : (
        <SuggestedPlanHero plan={suggested} lastDone={picker.lastDone[suggested.id]} today={day} />
      )}
      <ul aria-label="Plans" className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {picker.plans.map((plan) => (
          <li key={plan.id} className="min-w-0">
            <PlanCard
              plan={plan}
              lastDone={picker.lastDone[plan.id]}
              today={day}
              selected={selection.includes(plan.id)}
              onToggle={() => {
                setSelection((held) => toggleSelection(held, plan.id))
              }}
            />
          </li>
        ))}
      </ul>
      <p className="text-muted mx-1 text-[13px]">{MISSED_DAY_NOTE}</p>
      <div className={START_BAR_CLASS}>
        <PlanStartBar plans={chosen} source={startSource} />
      </div>
    </div>
  )
}
