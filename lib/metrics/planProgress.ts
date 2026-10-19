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

export function stepStatuses(
  steps: PlanStep[],
  sets: WorkoutSet[],
  cursor: PlanCursor,
): StepStatus[] {
  const logged = new Set(liveSets(sets, cursor).map((set) => set.exercise_id))
  const skipped = new Set(cursor.skipped)

  return steps.map((step, index) => {
    if (logged.has(step.exerciseId)) return 'done'
    if (index === cursor.stepIndex) return 'now'
    if (skipped.has(step.slug)) return 'skipped'
    return 'todo'
  })
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
