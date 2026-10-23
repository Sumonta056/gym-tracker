import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db, SIGNED_OUT_KEY } from '../../../lib/db/dexie'
import { getActiveSession, SignedOutOnThisDevice, startSession } from '../../../lib/db/repository'
import { listPlans } from '../../../lib/plans'

import WorkoutsPage from './page'

const push = vi.fn()

const router = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a page test')
  },
}))

beforeEach(async () => {
  push.mockClear()
  router.push.mockClear()
  vi.restoreAllMocks()
  vi.stubGlobal('location', { assign: push })
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
  ])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WorkoutsPage', () => {
  it('names the workouts screen as its heading', () => {
    render(<WorkoutsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Workouts' })).toBeInTheDocument()
  })

  it('sets the heading at the screen title size', () => {
    render(<WorkoutsPage />)
    const title = screen.getByRole('heading', { level: 1, name: 'Workouts' })
    expect(title).toHaveClass('text-[23px]', 'font-bold', 'tracking-[-0.6px]')
    expect(title).not.toHaveClass('text-3xl')
  })

  it('shows the history under the launcher', async () => {
    render(<WorkoutsPage />)
    const history = await screen.findByRole('region', { name: 'History' })
    const start = await screen.findByRole('button', { name: 'Start a session' })
    expect(start.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('builds no frame of its own, because the route group layout owns it', () => {
    render(<WorkoutsPage />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('starts a session and opens the live screen', async () => {
    render(<WorkoutsPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Start a session' }))

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/workout')
    })
    expect((await getActiveSession())?.status).toBe('active')
  })

  it('opens the live session inside the app, with no document load', async () => {
    render(<WorkoutsPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Start a session' }))

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/workout')
    })
    expect(push).not.toHaveBeenCalled()
  })

  it('shows Resume in place of Start while a session is active', async () => {
    await startSession('2026-09-01')
    render(<WorkoutsPage />)

    expect(await screen.findByRole('link', { name: 'Resume' })).toHaveAttribute('href', '/workout')
    expect(screen.queryByRole('button', { name: 'Start a session' })).not.toBeInTheDocument()
  })

  it('opens the live screen when another tab started a session first', async () => {
    render(<WorkoutsPage />)
    const start = await screen.findByRole('button', { name: 'Start a session' })
    await startSession('2026-09-01')

    await userEvent.click(start)

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/workout')
    })
  })

  it('names a signed-out device and stays', async () => {
    render(<WorkoutsPage />)
    const start = await screen.findByRole('button', { name: 'Start a session' })
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-09-01T10:00:00.000Z' })

    await userEvent.click(start)

    expect(await screen.findByRole('alert')).toHaveTextContent(new SignedOutOnThisDevice().message)
    expect(router.push).not.toHaveBeenCalled()
    expect(start).toBeEnabled()
  })

  it('says so when the session cannot be started', async () => {
    render(<WorkoutsPage />)
    const start = await screen.findByRole('button', { name: 'Start a session' })
    vi.spyOn(db.workoutSessions, 'put').mockRejectedValue(new Error('disk full'))

    await userEvent.click(start)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The session could not be started on this device.',
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  it('offers Start when the device cannot be read', async () => {
    vi.spyOn(db.workoutSessions, 'where').mockImplementation(() => {
      throw new Error('broken')
    })
    render(<WorkoutsPage />)

    expect(await screen.findByRole('button', { name: 'Start a session' })).toBeInTheDocument()
  })

  it('shows the suggested plan above 1 card per listed plan', async () => {
    render(<WorkoutsPage />)

    const hero = await screen.findByRole('region', { name: "Today's suggestion" })
    const plans = screen.getByRole('list', { name: 'Plans' })
    expect(hero).toHaveTextContent('Chest + Triceps')
    expect(within(plans).getAllByRole('button')).toHaveLength(listPlans().length)
    expect(hero.compareDocumentPosition(plans) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('puts the free session under its own label, below the plans', async () => {
    render(<WorkoutsPage />)

    const free = await screen.findByRole('region', { name: 'Free session' })
    const plans = await screen.findByRole('list', { name: 'Plans' })
    expect(within(free).getByRole('button', { name: 'Start a session' })).toBeInTheDocument()
    expect(plans.compareDocumentPosition(free) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the sync chip beside the heading', () => {
    render(<WorkoutsPage />)

    const header = screen.getByRole('banner')
    expect(header).toHaveTextContent('Workouts')
    expect(within(header).getByRole('status')).toBeInTheDocument()
  })

  it('puts the avatar right-most in its header', () => {
    render(<WorkoutsPage />)

    const header = screen.getByRole('banner')
    expect(header.lastElementChild?.lastElementChild).toHaveAccessibleName('Profile')
  })

  it('draws the free session Start as a secondary button under the plans', async () => {
    render(<WorkoutsPage />)

    expect(await screen.findByRole('button', { name: 'Start a session' })).toHaveClass(
      'bg-surface-2',
      'border-border',
    )
  })
})
