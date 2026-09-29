import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../../lib/db/dexie'
import { startSession } from '../../../lib/db/repository'

import WorkoutPage from './page'

vi.mock('../../../components/sync/SyncChip', () => ({
  SyncChip: () => <span>Synced</span>,
}))

vi.mock('../../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a page test')
  },
}))

beforeEach(async () => {
  await db.open()
  await Promise.all([db.workoutSessions.clear(), db.workoutSets.clear(), db.outbox.clear()])
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
})
