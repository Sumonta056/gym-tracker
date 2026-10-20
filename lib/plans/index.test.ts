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
} from './index'

import type { Plan, PlanId } from '../schema/plan'

function coach(id: PlanId): Plan {
  const plan = COACH_PLANS.find((candidate) => candidate.id === id)

  if (plan === undefined) {
    throw new Error(`expected the coach plan ${id}`)
  }

  return plan
}

describe('planSteps', () => {
  it('flattens the groups in order', () => {
    const steps = planSteps(coach('chest-triceps'))

    expect(steps).toHaveLength(9)
    expect(steps[0]?.slug).toBe('incline-dumbbell-press')
    expect(steps[5]?.slug).toBe('dumbbell-overhead-extension')
  })
})

describe('planMinutes', () => {
  it('gives 55, 55, 35 and 25 for the 4 coach plans', () => {
    expect(COACH_PLANS.map((plan) => planMinutes([plan]))).toEqual([55, 55, 35, 25])
  })

  it('gives 60 for shoulders and legs together', () => {
    expect(planMinutes([coach('shoulders'), coach('legs')])).toBe(60)
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
  it('returns 8 steps for shoulders and legs, shoulders first', () => {
    const combined = combinePlans(['shoulders', 'legs'])

    expect(combined.steps).toHaveLength(8)
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

    expect(combined.steps.map((step) => step.slug)).toEqual(['squat', 'leg-curl', 'leg-press'])
    expect(combined.title).toBe('Legs')
  })

  it('returns 0 steps and an empty title for no ids', () => {
    expect(combinePlans([])).toEqual({ title: '', steps: [] })
  })

  it('drops a repeated plan id', () => {
    const combined = combinePlans(['legs', 'legs'])

    expect(combined.steps).toHaveLength(3)
    expect(combined.title).toBe('Legs')
  })
})

describe('listPlans and getPlan', () => {
  it('lists the 4 coach plans when none is retired', () => {
    expect(listPlans().map((plan) => plan.id)).toEqual([
      'chest-triceps',
      'back-biceps',
      'shoulders',
      'legs',
    ])
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

    expect(plans.listPlans().map((plan) => plan.id)).toEqual([
      'chest-triceps',
      'back-biceps',
      'shoulders',
    ])
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

    expect(combined.steps.map((step) => step.slug)).toEqual(['squat', 'leg-curl', 'leg-press'])
  })
})
