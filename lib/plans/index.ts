import { COACH_PLANS } from './coach'

import type { Muscle, Plan, PlanId, PlanStep } from '../schema/plan'

const MINUTES_PER_STEP = 5
const MINUTES_PER_PLAN = 10

export function listPlans(): Plan[] {
  return COACH_PLANS.filter((plan) => !plan.retired)
}

export function getPlan(id: PlanId): Plan | undefined {
  return COACH_PLANS.find((plan) => plan.id === id)
}

export function findPlan(id: string): Plan | undefined {
  return listPlans().find((plan) => plan.id === id)
}

export function planSteps(plan: Plan): PlanStep[] {
  return plan.groups.flatMap((group) => group.steps)
}

export function planMuscles(plan: Plan): { primary: Muscle[]; secondary: Muscle[] } {
  const steps = planSteps(plan)
  const primary = [...new Set(steps.flatMap((step) => step.muscles.primary))]
  const main = new Set(primary)
  const secondary = [...new Set(steps.flatMap((step) => step.muscles.secondary))].filter(
    (muscle) => !main.has(muscle),
  )
  return { primary, secondary }
}

export function planMinutes(plans: Plan[]): number {
  return plans.reduce(
    (minutes, plan) => minutes + MINUTES_PER_PLAN + planSteps(plan).length * MINUTES_PER_STEP,
    0,
  )
}

export function combinePlans(ids: string[]): { title: string; steps: PlanStep[] } {
  const plans = [...new Set(ids)]
    .map((id) => COACH_PLANS.find((plan) => plan.id === id))
    .filter((plan) => plan !== undefined)
  const seen = new Set<string>()
  const steps = plans.flatMap(planSteps).filter((step) => {
    if (seen.has(step.exerciseId)) return false
    seen.add(step.exerciseId)
    return true
  })
  return { title: plans.map((plan) => plan.title).join(' + '), steps }
}

export function stepGroups(ids: string[]): Map<string, string> {
  const groups = new Map<string, string>()
  const plans = [...new Set(ids)]
    .map((id) => COACH_PLANS.find((plan) => plan.id === id))
    .filter((plan) => plan !== undefined)

  for (const group of plans.flatMap((plan) => plan.groups)) {
    for (const step of group.steps) {
      if (!groups.has(step.exerciseId)) groups.set(step.exerciseId, group.name)
    }
  }

  return groups
}
