import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AnalyticsPage from './page'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

vi.mock('../../../lib/db/repository', async () => {
  const { PROFILE } = await import('../../../tests/fixtures/dashboard')
  return {
    listRange: vi.fn(() => Promise.resolve([])),
    getProfile: vi.fn(() => Promise.resolve(PROFILE)),
  }
})

describe('AnalyticsPage', () => {
  it('names the stats screen as its heading', () => {
    render(<AnalyticsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Stats' })).toBeInTheDocument()
  })

  it('offers the day, week and month ranges', () => {
    render(<AnalyticsPage />)
    for (const name of ['Day', 'Week', 'Month']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('renders the charts once the device is read', async () => {
    render(<AnalyticsPage />)
    expect(await screen.findByTestId('analytics-grid')).toBeInTheDocument()
  })

  it('builds no frame of its own, because the route group layout owns it', async () => {
    render(<AnalyticsPage />)
    await screen.findByTestId('analytics-grid')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
