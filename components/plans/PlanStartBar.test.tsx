import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db, SIGNED_OUT_KEY } from '../../lib/db/dexie'
import {
  getActiveSession,
  getPlanCursor,
  SessionAlreadyActive,
  startSession,
} from '../../lib/db/repository'
import { getPlan } from '../../lib/plans'

import { PLAN_START_FAILED, PlanStartBar } from './PlanStartBar'

import type { PlanStartSource } from './PlanStartBar'
import type { WorkoutSession } from '../../lib/db/dexie'
import type { Plan, PlanId } from '../../lib/schema/plan'

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

function plan(id: PlanId): Plan {
  const found = getPlan(id)
  if (found === undefined) throw new Error(`expected the plan ${id}`)
  return found
}

function fakeSource() {
  return {
    getActiveSession: vi.fn<PlanStartSource['getActiveSession']>(() => Promise.resolve(undefined)),
    startPlanSession: vi.fn<PlanStartSource['startPlanSession']>(() =>
      Promise.resolve({ id: 'session-1' } as WorkoutSession),
    ),
    setPlanCursor: vi.fn<PlanStartSource['setPlanCursor']>(() => Promise.resolve()),
  }
}

beforeEach(async () => {
  router.push.mockClear()
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
    db.planCursors.clear(),
  ])
})

describe('PlanStartBar', () => {
  it('is disabled and asks for a plan with none picked', () => {
    render(<PlanStartBar plans={[]} />)

    expect(screen.getByRole('button', { name: 'Pick a plan to start' })).toBeDisabled()
  })

  it('names 1 plan with its exercises and minutes', () => {
    render(<PlanStartBar plans={[plan('chest-triceps')]} />)
    const button = screen.getByRole('button', { name: /^Start Chest \+ Triceps/ })

    expect(button).toBeEnabled()
    expect(button).toHaveTextContent('9 exercises · about 55 min')
  })

  it('names 2 plans and says combined', () => {
    render(<PlanStartBar plans={[plan('shoulders'), plan('legs')]} />)

    expect(screen.getByRole('button', { name: /^Start Shoulders \+ Legs/ })).toHaveTextContent(
      '8 exercises · about 60 min · combined',
    )
  })

  it('leaves the detail out when asked', () => {
    render(<PlanStartBar plans={[plan('legs')]} showDetail={false} />)

    expect(screen.getByRole('button', { name: 'Start Legs' })).toBeInTheDocument()
  })

  it('starts 2 plans once, in selection order, and opens the live screen', async () => {
    const source = fakeSource()
    render(
      <PlanStartBar
        plans={[plan('legs'), plan('shoulders')]}
        source={source}
        today={() => '2026-10-20'}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /^Start Legs \+ Shoulders/ }))

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/workout')
    })
    expect(source.startPlanSession).toHaveBeenCalledTimes(1)
    expect(source.startPlanSession).toHaveBeenCalledWith(['legs', 'shoulders'], '2026-10-20')
    expect(source.setPlanCursor).toHaveBeenCalledWith({
      sessionId: 'session-1',
      stepIndex: 0,
      skipped: [],
    })
  })

  it('writes a plan session and a cursor at step 0 on this device', async () => {
    render(<PlanStartBar plans={[plan('chest-triceps')]} />)

    await userEvent.click(screen.getByRole('button', { name: /^Start Chest \+ Triceps/ }))

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/workout')
    })
    const session = await getActiveSession()
    expect(session?.plan_ids).toEqual(['chest-triceps'])
    expect(await getPlanCursor(session?.id ?? '')).toEqual({
      sessionId: session?.id,
      stepIndex: 0,
      skipped: [],
    })
  })

  it('shows the resume prompt and starts nothing while a session is active', async () => {
    const running = await startSession('2026-10-20')
    render(<PlanStartBar plans={[plan('legs')]} />)

    await userEvent.click(screen.getByRole('button', { name: /^Start Legs/ }))

    expect(await screen.findByRole('dialog', { name: 'Session running' })).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
    expect((await getActiveSession())?.id).toBe(running.id)
    expect(await db.workoutSessions.count()).toBe(1)
  })

  it('shows the resume prompt when another tab started a session first', async () => {
    const source = fakeSource()
    source.startPlanSession.mockImplementation(() =>
      startSession('2026-10-20').then(() => {
        throw new SessionAlreadyActive()
      }),
    )
    render(<PlanStartBar plans={[plan('legs')]} source={source} />)

    await userEvent.click(screen.getByRole('button', { name: /^Start Legs/ }))

    expect(await screen.findByRole('dialog', { name: 'Session running' })).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('names a signed-out device and stays', async () => {
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-10-20T10:00:00.000Z' })
    render(<PlanStartBar plans={[plan('legs')]} />)
    const button = screen.getByRole('button', { name: /^Start Legs/ })

    await userEvent.click(button)

    expect(await screen.findByRole('alert')).toHaveTextContent('signed out')
    expect(router.push).not.toHaveBeenCalled()
    expect(button).toBeEnabled()
  })

  it('says so when the plan cannot be started', async () => {
    const source = fakeSource()
    source.startPlanSession.mockRejectedValue(new Error('disk full'))
    render(<PlanStartBar plans={[plan('legs')]} source={source} />)

    await userEvent.click(screen.getByRole('button', { name: /^Start Legs/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(PLAN_START_FAILED)
    expect(router.push).not.toHaveBeenCalled()
  })
})
