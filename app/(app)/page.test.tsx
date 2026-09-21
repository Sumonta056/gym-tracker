import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import HomePage from './page'

describe('HomePage', () => {
  it('names the day as its heading', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
  })

  it('renders inside the app shell, so it carries both navigations', () => {
    render(<HomePage />)
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Bottom navigation' })).toBeInTheDocument()
  })

  it('marks today as the current page', () => {
    render(<HomePage />)
    const links = screen.getAllByRole('link', { name: 'Today' })
    for (const link of links) {
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('says the daily tracker is still to come', () => {
    render(<HomePage />)
    expect(screen.getByText(/Phase 1/)).toBeInTheDocument()
  })
})
