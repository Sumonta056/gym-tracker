import { describe, expect, it } from 'vitest'

import { sessionOn } from '../../tests/fixtures/lifts'
import { listPlans } from '../plans'

import { lastDoneByPlan, suggestPlan } from './planSuggestion'

import type { Plan } from '../schema/plan'

const DELETED = '2026-09-23T12:30:00.000Z'

const COACH_ORDER = ['chest-triceps', 'back-biceps', 'shoulders', 'legs']

function fourPlans(): Plan[] {
  return listPlans().filter((plan) => COACH_ORDER.includes(plan.id))
}

describe('lastDoneByPlan', () => {
  it('returns an empty record for no sessions', () => {
    expect(lastDoneByPlan([])).toEqual({})
  })

  it('keeps the latest entry date for each plan', () => {
    const sessions = [
      sessionOn('2026-09-20', { plan_ids: ['legs'] }),
      sessionOn('2026-09-25', { plan_ids: ['legs'] }),
      sessionOn('2026-09-22', { plan_ids: ['legs'] }),
    ]

    expect(lastDoneByPlan(sessions)).toEqual({ legs: '2026-09-25' })
  })

  it('has no key for a plan that was never done', () => {
    const sessions = [sessionOn('2026-09-20', { plan_ids: ['shoulders'] })]

    expect(lastDoneByPlan(sessions)).not.toHaveProperty('legs')
  })

  it('counts a session with 2 plan ids for both plans', () => {
    const sessions = [sessionOn('2026-09-20', { plan_ids: ['chest-triceps', 'back-biceps'] })]

    expect(lastDoneByPlan(sessions)).toEqual({
      'chest-triceps': '2026-09-20',
      'back-biceps': '2026-09-20',
    })
  })

  it('counts a session with null plan ids for no plan', () => {
    expect(lastDoneByPlan([sessionOn('2026-09-20', { plan_ids: null })])).toEqual({})
  })

  it('counts a session with no plan ids key for no plan', () => {
    expect(lastDoneByPlan([sessionOn('2026-09-20')])).toEqual({})
  })

  it('ignores an active session', () => {
    const sessions = [
      sessionOn('2026-09-20', { plan_ids: ['legs'], status: 'active', ended_at: null }),
    ]

    expect(lastDoneByPlan(sessions)).toEqual({})
  })

  it('ignores a soft-deleted session', () => {
    const sessions = [sessionOn('2026-09-20', { plan_ids: ['legs'], deleted_at: DELETED })]

    expect(lastDoneByPlan(sessions)).toEqual({})
  })
})

describe('suggestPlan', () => {
  it('returns a plan that was never done before any plan that was', () => {
    const sessions = [
      sessionOn('2026-09-01', { plan_ids: ['chest-triceps'] }),
      sessionOn('2026-09-02', { plan_ids: ['back-biceps'] }),
      sessionOn('2026-09-03', { plan_ids: ['legs'] }),
    ]

    expect(suggestPlan(fourPlans(), sessions)).toBe('shoulders')
  })

  it('breaks a tie on the order of the plans it is given', () => {
    const sessions = [
      sessionOn('2026-09-20', {
        plan_ids: ['legs', 'shoulders', 'back-biceps', 'chest-triceps'],
      }),
    ]

    expect(suggestPlan(fourPlans(), sessions)).toBe(fourPlans()[0]?.id)
  })

  it('counts a combined session for both of its plans', () => {
    const sessions = [
      sessionOn('2026-09-20', { plan_ids: ['chest-triceps', 'back-biceps'] }),
      sessionOn('2026-09-10', { plan_ids: ['shoulders'] }),
      sessionOn('2026-09-15', { plan_ids: ['legs'] }),
    ]

    expect(suggestPlan(fourPlans(), sessions)).toBe('shoulders')
  })

  it('ignores an active session and a soft-deleted session', () => {
    const sessions = [
      sessionOn('2026-09-10', { plan_ids: ['chest-triceps', 'back-biceps', 'legs'] }),
      sessionOn('2026-09-20', { plan_ids: ['chest-triceps'], status: 'active', ended_at: null }),
      sessionOn('2026-09-21', { plan_ids: ['back-biceps'], deleted_at: DELETED }),
      sessionOn('2026-09-22', { plan_ids: ['shoulders'], deleted_at: DELETED }),
    ]

    expect(suggestPlan(fourPlans(), sessions)).toBe('shoulders')
  })

  it('returns undefined for no plans and no sessions', () => {
    expect(suggestPlan([], [])).toBeUndefined()
  })

  it('returns undefined for no plans even when sessions exist', () => {
    expect(suggestPlan([], [sessionOn('2026-09-20', { plan_ids: ['legs'] })])).toBeUndefined()
  })

  it('returns the first plan it is given when no plan was ever done', () => {
    expect(suggestPlan(fourPlans(), [])).toBe('chest-triceps')
  })

  it('returns the plan with the oldest last date when every plan was done', () => {
    const sessions = [
      sessionOn('2026-09-20', { plan_ids: ['chest-triceps'] }),
      sessionOn('2026-09-21', { plan_ids: ['back-biceps'] }),
      sessionOn('2026-09-12', { plan_ids: ['shoulders'] }),
      sessionOn('2026-09-23', { plan_ids: ['legs'] }),
    ]

    expect(suggestPlan(fourPlans(), sessions)).toBe('shoulders')
  })

  it('judges a plan by its latest date, not its oldest', () => {
    const sessions = [
      sessionOn('2026-09-01', { plan_ids: ['chest-triceps'] }),
      sessionOn('2026-09-25', { plan_ids: ['chest-triceps'] }),
      sessionOn('2026-09-10', { plan_ids: ['back-biceps', 'shoulders', 'legs'] }),
    ]

    expect(suggestPlan(fourPlans(), sessions)).toBe('back-biceps')
  })

  it('breaks a tie on the order of the given plans', () => {
    const reversed = [...fourPlans()].reverse()

    expect(suggestPlan(reversed, [])).toBe('legs')
  })

  it('returns the only plan when the list holds one', () => {
    const legs = listPlans().filter((plan) => plan.id === 'legs')
    const sessions = [sessionOn('2026-09-20', { plan_ids: ['legs'] })]

    expect(suggestPlan(legs, sessions)).toBe('legs')
  })
})
