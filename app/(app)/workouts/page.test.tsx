import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import WorkoutsPage from './page'

describe('WorkoutsPage', () => {
  it('names the workouts screen as its heading', () => {
    render(<WorkoutsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Workouts' })).toBeInTheDocument()
  })

  it('says the live workout log is still to come', () => {
    render(<WorkoutsPage />)
    expect(screen.getByText(/Phase 2/)).toBeInTheDocument()
  })

  it('builds no frame of its own, because the route group layout owns it', () => {
    render(<WorkoutsPage />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
