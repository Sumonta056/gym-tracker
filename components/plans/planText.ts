import { formatLoadShort, weightSymbol } from '../../lib/format/weight'
import { toDayNumber } from '../../lib/metrics/day'
import { combinePlans, planMinutes, planSteps } from '../../lib/plans'
import { plural } from '../workouts/historyText'

import type { WorkoutSet } from '../../lib/db/dexie'
import type { Plan, PlanId, PlanTarget } from '../../lib/schema/plan'
import type { UnitSystem } from '../../lib/schema/profile'

export const START_BAR_CLASS =
  'border-border bg-ground fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),10px)+63px)] z-30 border-t px-5 py-3 md:px-7 lg:static lg:max-w-sm lg:border-t-0 lg:p-0'

export const MAX_SELECTED = 2

export const PICK_A_PLAN = 'Pick a plan to start'

export const NEVER_DONE = 'never done'

export const NOT_DONE_YET = 'You have not done it yet'

export const MISSED_DAY_NOTE =
  'Missed a day? Do Shoulders and Legs together on your last gym day of the week so nothing gets skipped.'

export function planPath(id: PlanId): string {
  return `/workouts/${id}`
}

export function daysBetween(from: string, to: string): number {
  return Math.max(0, (toDayNumber(to) ?? 0) - (toDayNumber(from) ?? 0))
}

export function agoText(date: string, today: string): string {
  const days = daysBetween(date, today)

  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${String(days)} days ago`
}

export function lastDoneText(date: string | undefined, today: string): string {
  return date === undefined ? NEVER_DONE : `last done ${agoText(date, today)}`
}

export function reasonText(date: string | undefined, today: string): string {
  return date === undefined ? NOT_DONE_YET : `You did it least recently: ${agoText(date, today)}`
}

export function exercisesText(count: number): string {
  return plural(count, 'exercise')
}

export function cardLine(plan: Plan, date: string | undefined, today: string): string {
  return `${exercisesText(planSteps(plan).length)} · ${lastDoneText(date, today)}`
}

export function stepsLinkText(plan: Plan): string {
  return `See the ${plural(planSteps(plan).length, 'step')} →`
}

export function targetText(target: PlanTarget): string {
  const reps =
    target.repsMin === target.repsMax
      ? String(target.repsMin)
      : `${String(target.repsMin)}–${String(target.repsMax)}`

  return `${String(target.sets)} × ${reps}`
}

export function lastSetText(
  set: WorkoutSet | undefined,
  unit: UnitSystem,
  bodyweight = false,
): string {
  if (bodyweight) return 'body'
  if (set === undefined) return 'first time'
  if (set.weight_kg === null) return 'body'
  return `last ${formatLoadShort(set.weight_kg, unit)} ${weightSymbol(unit)}`
}

export function previewLine(plan: Plan): string {
  const steps = planSteps(plan)
  const sets = steps.reduce((total, step) => total + step.target.sets, 0)

  return `${exercisesText(steps.length)} · ${plural(sets, 'set')} · about ${String(planMinutes([plan]))} min`
}

export function startLabel(plans: readonly Plan[]): string {
  return plans.length === 0 ? PICK_A_PLAN : `Start ${plans.map((plan) => plan.title).join(' + ')}`
}

export function startDetail(plans: readonly Plan[]): string | null {
  if (plans.length === 0) return null

  const steps = combinePlans(plans.map((plan) => plan.id)).steps.length
  const line = `${exercisesText(steps)} · about ${String(planMinutes([...plans]))} min`

  return plans.length > 1 ? `${line} · combined` : line
}

export function toggleSelection(selection: readonly PlanId[], id: PlanId): PlanId[] {
  if (selection.includes(id)) {
    return selection.filter((held) => held !== id)
  }

  return [...selection, id].slice(-MAX_SELECTED)
}
