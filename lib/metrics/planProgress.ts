import { volumeLoad } from './volumeLoad'

import type { PlanCursor, WorkoutSet } from '../db/dexie'
import type { PlanStep } from '../schema/plan'

export type StepStatus = 'done' | 'skipped' | 'now' | 'todo'

export type PlanSessionSummary = {
  doneSteps: number
  skippedSteps: number
  setCount: number
  volumeKg: number
}

function liveSets(sets: WorkoutSet[], cursor: PlanCursor): WorkoutSet[] {
  return sets.filter((set) => set.session_id === cursor.sessionId && set.deleted_at === null)
}

function statusReader(
  sets: WorkoutSet[],
  cursor: PlanCursor,
): (step: PlanStep, index: number) => StepStatus {
  const logged = new Set(liveSets(sets, cursor).map((set) => set.exercise_id))
  const skipped = new Set(cursor.skipped)

  return (step, index) => {
    if (logged.has(step.exerciseId)) return 'done'
    if (index === cursor.stepIndex) return 'now'
    if (skipped.has(step.slug)) return 'skipped'
    return 'todo'
  }
}

export function stepStatuses(
  steps: PlanStep[],
  sets: WorkoutSet[],
  cursor: PlanCursor,
): StepStatus[] {
  return steps.map(statusReader(sets, cursor))
}

export function sessionSummary(
  steps: PlanStep[],
  sets: WorkoutSet[],
  cursor: PlanCursor,
): PlanSessionSummary {
  const statuses = stepStatuses(steps, sets, cursor)
  const live = liveSets(sets, cursor)

  return {
    doneSteps: statuses.filter((status) => status === 'done').length,
    skippedSteps: statuses.filter((status) => status === 'skipped').length,
    setCount: live.length,
    volumeKg: volumeLoad(live),
  }
}

export type StepOutcome = 'done' | 'skipped' | 'notDone'

export type StepResult = {
  step: PlanStep
  outcome: StepOutcome
  setCount: number
  heaviestKg: number | null
}

const OUTCOME: Record<StepStatus, StepOutcome> = {
  done: 'done',
  skipped: 'skipped',
  now: 'notDone',
  todo: 'notDone',
}

export function stepResults(
  steps: PlanStep[],
  sets: WorkoutSet[],
  cursor: PlanCursor,
): StepResult[] {
  const statusOf = statusReader(sets, cursor)
  const live = liveSets(sets, cursor)

  return steps.map((step, index) => {
    const own = live.filter((set) => set.exercise_id === step.exerciseId)
    const loads = own.flatMap((set) => (set.weight_kg === null ? [] : [set.weight_kg]))

    return {
      step,
      outcome: OUTCOME[statusOf(step, index)],
      setCount: own.length,
      heaviestKg: loads.length === 0 ? null : Math.max(...loads),
    }
  })
}
