import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db, SIGNED_OUT_KEY } from '../../../lib/db/dexie'
import { getActiveSession, SignedOutOnThisDevice, startSession } from '../../../lib/db/repository'

import WorkoutsPage from './page'

const push = vi.fn()

vi.mock('../../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a page test')
  },
}))

beforeEach(async () => {
  push.mockClear()
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

  it('keeps the rest of the placeholder', () => {
    render(<WorkoutsPage />)
    expect(screen.getByText(/Phase 2/)).toBeInTheDocument()
  })

  it('builds no frame of its own, because the route group layout owns it', () => {
    render(<WorkoutsPage />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('starts a session and opens the live screen', async () => {
    render(<WorkoutsPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Start a session' }))

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/workout')
    })
    expect((await getActiveSession())?.status).toBe('active')
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
      expect(push).toHaveBeenCalledWith('/workout')
    })
  })

  it('names a signed-out device and stays', async () => {
    render(<WorkoutsPage />)
    const start = await screen.findByRole('button', { name: 'Start a session' })
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-09-01T10:00:00.000Z' })

    await userEvent.click(start)

    expect(await screen.findByRole('alert')).toHaveTextContent(new SignedOutOnThisDevice().message)
    expect(push).not.toHaveBeenCalled()
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
    expect(push).not.toHaveBeenCalled()
  })

  it('offers Start when the device cannot be read', async () => {
    vi.spyOn(db.workoutSessions, 'where').mockImplementation(() => {
      throw new Error('broken')
    })
    render(<WorkoutsPage />)

    expect(await screen.findByRole('button', { name: 'Start a session' })).toBeInTheDocument()
  })
})
