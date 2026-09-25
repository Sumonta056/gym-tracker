import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import LogPage from './page'

vi.mock('../../../lib/db/repository', () => ({
  getDay: vi.fn(() => Promise.resolve(undefined)),
  upsertDay: vi.fn(() => Promise.resolve()),
}))

describe('LogPage', () => {
  it('names the log screen as its heading', () => {
    render(<LogPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Log' })).toBeInTheDocument()
  })

  it('renders the daily entry form', () => {
    render(<LogPage />)
    expect(screen.getByRole('button', { name: 'Save entry' })).toBeInTheDocument()
  })

  it('builds no frame of its own, because the route group layout owns it', () => {
    render(<LogPage />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
