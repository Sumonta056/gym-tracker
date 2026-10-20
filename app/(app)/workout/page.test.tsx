import { configure, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../../lib/db/dexie'
import { startPlanSession, startSession } from '../../../lib/db/repository'

import WorkoutPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../../components/sync/SyncChip', () => ({
  SyncChip: () => <span>Synced</span>,
}))

vi.mock('../../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a page test')
  },
}))

configure({ asyncUtilTimeout: 5000 })
vi.setConfig({ testTimeout: 20000 })

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.outbox.clear(),
    db.planCursors.clear(),
  ])
})

describe('WorkoutPage', () => {
  it('names the live session as its heading', async () => {
    await startSession('2026-09-01')
    render(<WorkoutPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Session' })).toBeInTheDocument()
  })

  it('offers Finish and Add exercise as its main actions', async () => {
    await startSession('2026-09-01')
    render(<WorkoutPage />)

    expect(await screen.findByRole('button', { name: 'Finish session' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add exercise' })).toBeInTheDocument()
  })

  it('builds no frame of its own, because the route group layout owns it', async () => {
    render(<WorkoutPage />)

    await screen.findByRole('heading', { level: 1, name: 'Session' })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('shows the Phase 2 screen for a free session', async () => {
    await startSession('2026-09-01')
    render(<WorkoutPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Session' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Steps' })).toBeNull()
  })

  it('shows the guided step for a plan session', async () => {
    await startPlanSession(['chest-triceps'], '2026-09-01')
    render(<WorkoutPage />)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Incline Dumbbell Press' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Steps' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add exercise' })).toBeNull()
  })

  it('falls back to the Phase 2 screen for a plan id it does not know', async () => {
    const session = await startSession('2026-09-01')
    await db.workoutSessions.update(session.id, { plan_ids: ['retired-plan'] as never })
    render(<WorkoutPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Session' })).toBeInTheDocument()
  })

  it('shows reading while the device is read', () => {
    render(<WorkoutPage />)

    expect(screen.getByRole('status')).toHaveTextContent('Reading this device…')
  })

  it('falls back to the Phase 2 screen when the device cannot be read', async () => {
    const where = vi.spyOn(db.workoutSessions, 'where').mockImplementation(() => {
      throw new Error('broken')
    })
    render(<WorkoutPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The session could not be read on this device.',
    )
    where.mockRestore()
  })
})
