import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import HomePage from './page'

vi.mock('../../lib/db/repository', () => ({
  useSyncStatus: () => ({ status: 'synced', pending: 0, failed: 0 }),
  listRange: vi.fn(() => Promise.resolve([])),
  getProfile: vi.fn(() =>
    Promise.resolve({
      id: '00000000-0000-4000-8000-000000000000',
      display_name: null,
      unit_system: 'metric',
      height_cm: null,
      target_weight_kg: null,
      step_goal: 12000,
      updated_at: '1970-01-01T00:00:00.000Z',
    }),
  ),
}))

describe('HomePage', () => {
  it('renders the dashboard, with the empty state when today has no entry', async () => {
    render(<HomePage />)
    expect(await screen.findByRole('link', { name: 'Log the day' })).toHaveAttribute('href', '/log')
  })

  it('names the date as its heading', async () => {
    render(<HomePage />)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('builds no frame of its own, because the route group layout owns it', async () => {
    render(<HomePage />)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
