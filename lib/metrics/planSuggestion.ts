import type { WorkoutSession } from '../db/dexie'
import type { Plan, PlanId } from '../schema/plan'

export function lastDoneByPlan(sessions: WorkoutSession[]): Partial<Record<PlanId, string>> {
  const last: Partial<Record<PlanId, string>> = {}

  for (const session of sessions) {
    if (session.status !== 'finished' || session.deleted_at !== null) {
      continue
    }

    for (const id of session.plan_ids ?? []) {
      const known = last[id]
      if (known === undefined || session.entry_date > known) {
        last[id] = session.entry_date
      }
    }
  }

  return last
}

export function suggestPlan(plans: Plan[], sessions: WorkoutSession[]): PlanId | undefined {
  const last = lastDoneByPlan(sessions)
  let best: { id: PlanId; date: string | undefined } | undefined

  for (const plan of plans) {
    const date = last[plan.id]
    if (best === undefined) {
      best = { id: plan.id, date }
      continue
    }
    if (best.date === undefined) {
      break
    }
    if (date === undefined || date < best.date) {
      best = { id: plan.id, date }
    }
  }

  return best?.id
}
