import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../lib/db/dexie'
import { addSet, finishSession, startSession } from '../../lib/db/repository'
import { getPlan, planSteps } from '../../lib/plans'

import { PlanStepList, readLastSets } from './PlanStepList'

import type { WorkoutSet } from '../../lib/db/dexie'
import type { Plan, PlanId } from '../../lib/schema/plan'

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

function plan(id: PlanId): Plan {
  const found = getPlan(id)
  if (found === undefined) throw new Error(`expected the plan ${id}`)
  return found
}

function lastSet(weight: number | null): WorkoutSet {
  return { reps: 10, weight_kg: weight } as WorkoutSet
}

beforeEach(async () => {
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
    db.profiles.clear(),
  ])
})

describe('PlanStepList', () => {
  it('lists 9 steps in 2 groups for chest and triceps', () => {
    render(<PlanStepList plan={plan('chest-triceps')} />)

    const chest = screen.getByRole('region', { name: 'Chest' })
    const triceps = screen.getByRole('region', { name: 'Triceps' })

    expect(within(chest).getAllByRole('listitem')).toHaveLength(5)
    expect(within(triceps).getAllByRole('listitem')).toHaveLength(4)
  })

  it('numbers the steps across the groups', () => {
    render(<PlanStepList plan={plan('chest-triceps')} />)
    const triceps = screen.getByRole('region', { name: 'Triceps' })

    expect(within(triceps).getAllByRole('listitem')[0]).toHaveTextContent(
      /^6Dumbbell Overhead Extension/,
    )
  })

  it('gives 1 watch pill per step that has a video', () => {
    const chestTriceps = plan('chest-triceps')
    render(<PlanStepList plan={chestTriceps} />)

    const withVideo = planSteps(chestTriceps).filter((step) => step.video !== undefined)
    expect(screen.getAllByRole('link', { name: /^Watch / })).toHaveLength(withVideo.length)
    expect(screen.getByRole('link', { name: 'Watch Bench Dips' })).toBeInTheDocument()
  })

  it('gives no watch pill to a step with no video', () => {
    const legs = plan('legs')
    const bare: Plan = {
      ...legs,
      groups: legs.groups.map((group) => ({
        ...group,
        steps: group.steps.map((step) => ({ ...step, video: undefined })),
      })),
    }
    render(<PlanStepList plan={bare} />)

    expect(screen.queryByRole('link', { name: /^Watch / })).not.toBeInTheDocument()
  })

  it('shows each thumbnail with an empty alt', () => {
    const { container } = render(<PlanStepList plan={plan('legs')} />)
    const images = [...container.querySelectorAll('img')]

    expect(images).toHaveLength(3)
    expect(images.every((image) => image.getAttribute('alt') === '')).toBe(true)
  })

  it('reads first time for a step never logged', async () => {
    render(<PlanStepList plan={plan('legs')} />)

    expect(await screen.findAllByText('3 × 10–12 · first time')).toHaveLength(3)
  })

  it('names the last weight of a step from an earlier session', async () => {
    const legs = plan('legs')
    const squat = planSteps(legs)[0]
    if (squat === undefined) throw new Error('expected the squat step')
    const session = await startSession('2026-10-14')
    await addSet({ session_id: session.id, exercise_id: squat.exerciseId, reps: 10, weight_kg: 60 })
    await finishSession(session.id)

    render(<PlanStepList plan={legs} />)

    expect(await screen.findByText('3 × 10–12 · last 60 kg')).toBeInTheDocument()
  })

  it('names the weight in the unit the source gives', async () => {
    const legs = plan('legs')
    const squat = planSteps(legs)[0]
    if (squat === undefined) throw new Error('expected the squat step')
    const source = vi.fn(() =>
      Promise.resolve({
        unit: 'imperial' as const,
        sets: new Map([[squat.exerciseId, lastSet(10)]]),
      }),
    )

    render(<PlanStepList plan={legs} source={source} />)

    expect(await screen.findByText('3 × 10–12 · last 22 lb')).toBeInTheDocument()
  })

  it('reads body for a last set with no weight', async () => {
    const legs = plan('legs')
    const squat = planSteps(legs)[0]
    if (squat === undefined) throw new Error('expected the squat step')
    const source = () =>
      Promise.resolve({
        unit: 'metric' as const,
        sets: new Map([[squat.exerciseId, lastSet(null)]]),
      })

    render(<PlanStepList plan={legs} source={source} />)

    expect(await screen.findByText('3 × 10–12 · body')).toBeInTheDocument()
  })

  it('falls back to first time when the device cannot be read', async () => {
    render(<PlanStepList plan={plan('legs')} source={() => Promise.reject(new Error('broken'))} />)

    expect(await screen.findAllByText('3 × 10–12 · first time')).toHaveLength(3)
  })
})

describe('readLastSets', () => {
  it('maps only the steps that have a finished set', async () => {
    const steps = planSteps(plan('legs'))
    const read = await readLastSets(steps)

    expect(read.unit).toBe('metric')
    expect(read.sets.size).toBe(0)
  })
})
