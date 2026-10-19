import { describe, expect, it } from 'vitest'

import { liftSet, sessionOn } from '../../tests/fixtures/lifts'
import { getPlan, planSteps } from '../plans'

import { sessionSummary, stepStatuses } from './planProgress'
import { volumeLoad } from './volumeLoad'

import type { PlanCursor } from '../db/dexie'
import type { PlanStep } from '../schema/plan'

const DELETED = '2026-09-23T12:30:00.000Z'

function chestSteps(): PlanStep[] {
  const plan = getPlan('chest-triceps')

  if (plan === undefined) {
    throw new Error('The chest-triceps plan is missing.')
  }

  return planSteps(plan)
}

function stepAt(index: number): PlanStep {
  const step = chestSteps()[index]

  if (step === undefined) {
    throw new Error(`The chest-triceps plan has no step ${String(index)}.`)
  }

  return step
}

function today() {
  return sessionOn('2026-09-23')
}

function cursor(patch: Partial<PlanCursor> = {}): PlanCursor {
  return { sessionId: today().id, stepIndex: 0, skipped: [], ...patch }
}

describe('stepStatuses', () => {
  it('returns one status per step in step order', () => {
    expect(stepStatuses(chestSteps(), [], cursor())).toHaveLength(chestSteps().length)
  })

  it('returns no status for no steps', () => {
    expect(stepStatuses([], [], cursor())).toEqual([])
  })

  it('marks the cursor step now and every other step todo', () => {
    const statuses = stepStatuses(chestSteps(), [], cursor({ stepIndex: 2 }))

    expect(statuses).toEqual(chestSteps().map((_, index) => (index === 2 ? 'now' : 'todo')))
  })

  it('marks a step with a set as done', () => {
    const sets = [liftSet(today(), stepAt(1).exerciseId, 10, 20)]

    expect(stepStatuses(chestSteps(), sets, cursor())[1]).toBe('done')
  })

  it('marks the cursor step with a set as done, not now', () => {
    const sets = [liftSet(today(), stepAt(0).exerciseId, 10, 20)]

    expect(stepStatuses(chestSteps(), sets, cursor({ stepIndex: 0 }))[0]).toBe('done')
  })

  it('marks a skipped step with a set as done', () => {
    const sets = [liftSet(today(), stepAt(3).exerciseId, 10, 12)]
    const skipped = cursor({ skipped: [stepAt(3).slug] })

    expect(stepStatuses(chestSteps(), sets, skipped)[3]).toBe('done')
  })

  it('marks a skipped step with no set as skipped', () => {
    const skipped = cursor({ skipped: [stepAt(3).slug] })

    expect(stepStatuses(chestSteps(), [], skipped)[3]).toBe('skipped')
  })

  it('marks the cursor step now even when it is in the skipped list', () => {
    const skipped = cursor({ stepIndex: 3, skipped: [stepAt(3).slug] })

    expect(stepStatuses(chestSteps(), [], skipped)[3]).toBe('now')
  })

  it('ignores a soft-deleted set', () => {
    const sets = [liftSet(today(), stepAt(1).exerciseId, 10, 20, { deleted_at: DELETED })]

    expect(stepStatuses(chestSteps(), sets, cursor())[1]).toBe('todo')
  })

  it('ignores a set from another session', () => {
    const sets = [liftSet(sessionOn('2026-09-20'), stepAt(1).exerciseId, 10, 20)]

    expect(stepStatuses(chestSteps(), sets, cursor())[1]).toBe('todo')
  })

  it('ignores a set of an exercise outside the steps', () => {
    const sets = [liftSet(today(), '00000000-0000-4000-8000-0000000000ff', 10, 20)]

    expect(stepStatuses(chestSteps(), sets, cursor())).toEqual(
      chestSteps().map((_, index) => (index === 0 ? 'now' : 'todo')),
    )
  })

  it('marks a cursor index past the last step as no step now', () => {
    const statuses = stepStatuses(chestSteps(), [], cursor({ stepIndex: chestSteps().length }))

    expect(statuses).toEqual(chestSteps().map(() => 'todo'))
  })
})

describe('sessionSummary', () => {
  it('returns 0, 0, 0 and 0 for an empty session', () => {
    expect(sessionSummary(chestSteps(), [], cursor())).toEqual({
      doneSteps: 0,
      skippedSteps: 0,
      setCount: 0,
      volumeKg: 0,
    })
  })

  it('has a volume equal to volumeLoad for the same sets', () => {
    const sets = [
      liftSet(today(), stepAt(0).exerciseId, 10, 22.5),
      liftSet(today(), stepAt(0).exerciseId, 8, 25),
      liftSet(today(), stepAt(1).exerciseId, 12, 17.5),
    ]

    expect(sessionSummary(chestSteps(), sets, cursor()).volumeKg).toBe(volumeLoad(sets))
  })

  it('adds 0 volume for a body-weight set with a null load, not an error', () => {
    const sets = [
      liftSet(today(), stepAt(8).exerciseId, 15, null),
      liftSet(today(), stepAt(0).exerciseId, 10, 20),
    ]

    expect(sessionSummary(chestSteps(), sets, cursor())).toMatchObject({
      setCount: 2,
      volumeKg: 200,
    })
  })

  it('counts the done steps and the skipped steps', () => {
    const sets = [
      liftSet(today(), stepAt(0).exerciseId, 10, 20),
      liftSet(today(), stepAt(1).exerciseId, 10, 20),
      liftSet(today(), stepAt(2).exerciseId, 10, 10),
    ]
    const skipped = cursor({
      stepIndex: 5,
      skipped: [stepAt(2).slug, stepAt(3).slug, stepAt(4).slug],
    })

    expect(sessionSummary(chestSteps(), sets, skipped)).toMatchObject({
      doneSteps: 3,
      skippedSteps: 2,
    })
  })

  it('leaves the cursor step out of the skipped count', () => {
    const skipped = cursor({ stepIndex: 3, skipped: [stepAt(3).slug] })

    expect(sessionSummary(chestSteps(), [], skipped).skippedSteps).toBe(0)
  })

  it('counts every live set of the session, even one outside the steps', () => {
    const sets = [
      liftSet(today(), stepAt(0).exerciseId, 10, 20),
      liftSet(today(), '00000000-0000-4000-8000-0000000000ff', 5, 40),
    ]

    expect(sessionSummary(chestSteps(), sets, cursor())).toMatchObject({
      setCount: 2,
      volumeKg: 400,
    })
  })

  it('leaves out a soft-deleted set from the count and the volume', () => {
    const sets = [
      liftSet(today(), stepAt(0).exerciseId, 10, 20),
      liftSet(today(), stepAt(0).exerciseId, 10, 100, { deleted_at: DELETED }),
    ]

    expect(sessionSummary(chestSteps(), sets, cursor())).toMatchObject({
      doneSteps: 1,
      setCount: 1,
      volumeKg: 200,
    })
  })

  it('leaves out a set from another session from the count and the volume', () => {
    const sets = [
      liftSet(today(), stepAt(0).exerciseId, 10, 20),
      liftSet(sessionOn('2026-09-20'), stepAt(1).exerciseId, 10, 100),
    ]

    expect(sessionSummary(chestSteps(), sets, cursor())).toMatchObject({
      doneSteps: 1,
      setCount: 1,
      volumeKg: 200,
    })
  })
})
