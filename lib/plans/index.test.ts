import { afterEach, describe, expect, it, vi } from 'vitest'

import { COACH_PLANS } from './coach'

import {
  combinePlans,
  findPlan,
  getPlan,
  listPlans,
  planMinutes,
  planMuscles,
  planSteps,
  stepGroups,
} from './index'

import type { Plan, PlanId } from '../schema/plan'

function coach(id: PlanId): Plan {
  const plan = COACH_PLANS.find((candidate) => candidate.id === id)

  if (plan === undefined) {
    throw new Error(`expected the coach plan ${id}`)
  }

  return plan
}

function stepCount(plan: Plan): number {
  return plan.groups.reduce((sum, group) => sum + group.steps.length, 0)
}

function slugs(id: PlanId): string[] {
  return coach(id).groups.flatMap((group) => group.steps.map((step) => step.slug))
}

describe('planSteps', () => {
  it('flattens the groups in order', () => {
    const plan = coach('chest-triceps')

    expect(planSteps(plan)).toEqual(plan.groups.flatMap((group) => group.steps))
    expect(planSteps(plan)[0]?.slug).toBe('incline-dumbbell-press')
  })
})

describe('planMinutes', () => {
  it('gives 10 minutes per plan and 5 per step', () => {
    expect(COACH_PLANS.map((plan) => planMinutes([plan]))).toEqual(
      COACH_PLANS.map((plan) => 10 + 5 * stepCount(plan)),
    )
  })

  it('adds the minutes of shoulders and legs together', () => {
    expect(planMinutes([coach('shoulders'), coach('legs')])).toBe(
      20 + 5 * (stepCount(coach('shoulders')) + stepCount(coach('legs'))),
    )
  })

  it('gives 0 for no plan', () => {
    expect(planMinutes([])).toBe(0)
  })
})

describe('planMuscles', () => {
  it('lists every main muscle of the plan once, in step order', () => {
    const { primary } = planMuscles(coach('chest-triceps'))

    expect(primary[0]).toBe('chest')
    expect(new Set(primary).size).toBe(primary.length)
  })

  it('keeps a muscle that is main in 1 step out of the helpers', () => {
    const { primary, secondary } = planMuscles(coach('chest-triceps'))

    expect(primary).toContain('triceps')
    expect(secondary).not.toContain('triceps')
    expect(secondary.every((muscle) => !primary.includes(muscle))).toBe(true)
  })
})

describe('combinePlans', () => {
  it('returns the steps of shoulders and then legs', () => {
    const combined = combinePlans(['shoulders', 'legs'])

    expect(combined.steps.map((step) => step.slug)).toEqual([
      ...planSteps(coach('shoulders')).map((step) => step.slug),
      ...planSteps(coach('legs')).map((step) => step.slug),
    ])
  })

  it('joins the plan titles with a plus', () => {
    expect(combinePlans(['shoulders', 'legs']).title).toBe('Shoulders + Legs')
  })

  it('keeps the order of the ids it is given', () => {
    expect(combinePlans(['legs', 'shoulders']).steps[0]?.slug).toBe('squat')
    expect(combinePlans(['legs', 'shoulders']).title).toBe('Legs + Shoulders')
  })

  it('drops an unknown id', () => {
    const combined = combinePlans(['legs', 'nope'])

    expect(combined.steps.map((step) => step.slug)).toEqual(slugs('legs'))
    expect(combined.title).toBe('Legs')
  })

  it('returns 0 steps and an empty title for no ids', () => {
    expect(combinePlans([])).toEqual({ title: '', steps: [] })
  })

  it('drops a repeated plan id', () => {
    const combined = combinePlans(['legs', 'legs'])

    expect(combined.steps).toHaveLength(stepCount(coach('legs')))
    expect(combined.title).toBe('Legs')
  })
})

describe('listPlans and getPlan', () => {
  it('lists every coach plan that is not retired, in order', () => {
    expect(listPlans().map((plan) => plan.id)).toEqual(
      COACH_PLANS.filter((plan) => !plan.retired).map((plan) => plan.id),
    )
    expect(
      listPlans()
        .map((plan) => plan.id)
        .slice(0, 4),
    ).toEqual(['chest-triceps', 'back-biceps', 'shoulders', 'legs'])
  })

  it('finds a plan by id', () => {
    expect(getPlan('legs')?.title).toBe('Legs')
  })

  it('finds a listed plan from any text id', () => {
    expect(findPlan('legs')?.title).toBe('Legs')
    expect(findPlan('nope')).toBeUndefined()
  })
})

describe('with a retired plan', () => {
  afterEach(() => {
    vi.doUnmock('./coach')
    vi.resetModules()
  })

  async function withRetiredLegs() {
    vi.resetModules()
    vi.doMock('./coach', () => ({
      COACH_PLANS: COACH_PLANS.map((plan) =>
        plan.id === 'legs' ? { ...plan, retired: true } : plan,
      ),
    }))
    return import('./index')
  }

  it('hides a retired plan from listPlans', async () => {
    const plans = await withRetiredLegs()

    expect(plans.listPlans().map((plan) => plan.id)).toEqual(
      COACH_PLANS.filter((plan) => !plan.retired && plan.id !== 'legs').map((plan) => plan.id),
    )
  })

  it('hides a retired plan from findPlan', async () => {
    const plans = await withRetiredLegs()

    expect(plans.findPlan('legs')).toBeUndefined()
  })

  it('still finds a retired plan with getPlan', async () => {
    const plans = await withRetiredLegs()

    expect(plans.getPlan('legs')?.retired).toBe(true)
  })

  it('drops a repeated step and keeps the first', async () => {
    vi.resetModules()
    const shoulders = coach('shoulders')
    const squat = planSteps(coach('legs'))[0]
    if (squat === undefined) throw new Error('expected the squat step')
    vi.doMock('./coach', () => ({
      COACH_PLANS: COACH_PLANS.map((plan) =>
        plan.id === 'shoulders'
          ? { ...shoulders, groups: [{ name: 'Shoulders', steps: [squat] }] }
          : plan,
      ),
    }))
    const plans = await import('./index')

    const combined = plans.combinePlans(['shoulders', 'legs'])

    expect(combined.steps.map((step) => step.slug)).toEqual(slugs('legs'))
  })
})

describe('stepGroups', () => {
  it('names the coach group of every step of 1 plan', () => {
    const groups = stepGroups(['chest-triceps'])
    const chest = COACH_PLANS[0]?.groups[0]?.steps[0]?.exerciseId ?? ''
    const triceps = COACH_PLANS[0]?.groups[1]?.steps[0]?.exerciseId ?? ''

    expect(groups.get(chest)).toBe('Chest')
    expect(groups.get(triceps)).toBe('Triceps')
  })

  it('keeps the first group for an exercise that 2 plans share', () => {
    const groups = stepGroups(['shoulders', 'legs', 'shoulders'])

    expect(groups.size).toBe(
      new Set(
        COACH_PLANS.filter((plan) => ['shoulders', 'legs'].includes(plan.id)).flatMap((plan) =>
          plan.groups.flatMap((group) => group.steps.map((step) => step.exerciseId)),
        ),
      ).size,
    )
  })

  it('returns no group for an unknown plan id', () => {
    expect(stepGroups(['retired-plan']).size).toBe(0)
  })
})
