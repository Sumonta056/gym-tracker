import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import HomePage from './page'

describe('HomePage', () => {
  it('names the day as its heading', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
  })

  it('builds no frame of its own, because the route group layout owns it', () => {
    render(<HomePage />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('says the daily tracker is still to come', () => {
    render(<HomePage />)
    expect(screen.getByText(/Phase 1/)).toBeInTheDocument()
  })
})
