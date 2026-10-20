import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PlanPicker } from './PlanPicker'
import { MISSED_DAY_NOTE } from './planText'

import type { PlanStartSource } from './PlanStartBar'
import type { WorkoutSession } from '../../lib/db/dexie'
import type { PlanId } from '../../lib/schema/plan'

const router = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/workouts',
}))

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

const TODAY = '2026-10-20'

function done(planIds: PlanId[], date: string): WorkoutSession {
  return {
    id: `${planIds.join('-')}-${date}`,
    entry_date: date,
    started_at: `${date}T10:00:00.000Z`,
    ended_at: `${date}T11:00:00.000Z`,
    status: 'finished',
    plan_ids: planIds,
    created_at: `${date}T10:00:00.000Z`,
    updated_at: `${date}T11:00:00.000Z`,
    deleted_at: null,
  }
}

const EVERY_PLAN_DONE = [
  done(['chest-triceps'], '2026-10-14'),
  done(['back-biceps'], '2026-10-18'),
  done(['shoulders'], '2026-10-16'),
  done(['legs'], '2026-10-17'),
]

const LEGS_NEVER_DONE = [
  done(['chest-triceps'], '2026-10-14'),
  done(['back-biceps'], '2026-10-18'),
  done(['shoulders'], '2026-10-16'),
]

function renderPicker(sessions: WorkoutSession[], startSource?: PlanStartSource) {
  render(
    <PlanPicker
      history={() => Promise.resolve(sessions)}
      today={TODAY}
      startSource={startSource}
    />,
  )
}

function card(name: RegExp) {
  return within(screen.getByRole('list', { name: 'Plans' })).getByRole('button', { name })
}

async function hero() {
  return screen.findByRole('region', { name: "Today's suggestion" })
}

describe('PlanPicker', () => {
  it('names the plan done least recently in the hero', async () => {
    renderPicker(EVERY_PLAN_DONE)

    const suggestion = await hero()
    expect(suggestion).toHaveTextContent('Chest + Triceps')
    expect(suggestion).toHaveTextContent('You did it least recently: 6 days ago')
  })

  it('suggests a plan never done before any other', async () => {
    renderPicker(LEGS_NEVER_DONE)

    expect(await hero()).toHaveTextContent('Legs')
    expect(card(/^Legs/)).toHaveTextContent('3 exercises · never done')
  })

  it('shows the 4 plan cards', async () => {
    renderPicker(EVERY_PLAN_DONE)
    await hero()

    expect(within(screen.getByRole('list', { name: 'Plans' })).getAllByRole('button')).toHaveLength(
      4,
    )
  })

  it('starts with the suggested plan selected', async () => {
    renderPicker(LEGS_NEVER_DONE)
    await hero()

    expect(card(/^Legs/)).toHaveAttribute('aria-pressed', 'true')
    expect(card(/^Chest \+ Triceps/)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /^Start Legs/ })).toBeEnabled()
  })

  it('selects a second plan and names both on Start', async () => {
    renderPicker(LEGS_NEVER_DONE)
    await hero()

    await userEvent.click(card(/^Shoulders/))

    expect(screen.getByRole('button', { name: /^Start Legs \+ Shoulders/ })).toHaveTextContent(
      'combined',
    )
  })

  it('drops the oldest selection on a third tap', async () => {
    renderPicker(LEGS_NEVER_DONE)
    await hero()

    await userEvent.click(card(/^Shoulders/))
    await userEvent.click(card(/^Back \+ Biceps/))

    expect(card(/^Legs/)).toHaveAttribute('aria-pressed', 'false')
    expect(card(/^Shoulders/)).toHaveAttribute('aria-pressed', 'true')
    expect(card(/^Back \+ Biceps/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Start Shoulders \+ Back \+ Biceps/ })).toBeEnabled()
  })

  it('disables Start when every plan is unselected', async () => {
    renderPicker(LEGS_NEVER_DONE)
    await hero()

    await userEvent.click(card(/^Legs/))

    expect(screen.getByRole('button', { name: 'Pick a plan to start' })).toBeDisabled()
  })

  it('starts the selection in the order it was picked', async () => {
    const source: PlanStartSource = {
      getActiveSession: () => Promise.resolve(undefined),
      startPlanSession: vi.fn(() => Promise.resolve({ id: 'session-1' } as WorkoutSession)),
      setPlanCursor: () => Promise.resolve(),
    }
    renderPicker(LEGS_NEVER_DONE, source)
    await hero()

    await userEvent.click(card(/^Shoulders/))
    await userEvent.click(screen.getByRole('button', { name: /^Start Legs \+ Shoulders/ }))

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/workout')
    })
    expect(source.startPlanSession).toHaveBeenCalledTimes(1)
    expect(source.startPlanSession).toHaveBeenCalledWith(['legs', 'shoulders'], expect.any(String))
  })

  it('shows the missed-day note in the coach words', async () => {
    renderPicker(EVERY_PLAN_DONE)
    await hero()

    expect(screen.getByText(MISSED_DAY_NOTE)).toBeInTheDocument()
  })

  it('treats a device that cannot be read as no plan done yet', async () => {
    render(<PlanPicker history={() => Promise.reject(new Error('broken'))} today={TODAY} />)

    expect(await hero()).toHaveTextContent('Chest + Triceps')
    expect(card(/^Legs/)).toHaveTextContent('never done')
  })

  it('reads this device when no history source is given', async () => {
    render(<PlanPicker />)

    expect(await hero()).toHaveTextContent('Chest + Triceps')
  })
})
