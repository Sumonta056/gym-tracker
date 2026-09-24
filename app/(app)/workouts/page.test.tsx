import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import WorkoutsPage from './page'

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

  it('says the live workout log is still to come', () => {
    render(<WorkoutsPage />)
    expect(screen.getByText(/Phase 2/)).toBeInTheDocument()
  })

  it('builds no frame of its own, because the route group layout owns it', () => {
    render(<WorkoutsPage />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
