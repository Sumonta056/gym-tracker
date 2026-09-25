import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import OfflinePage, { metadata } from './page'

describe('OfflinePage', () => {
  it('says the user is offline', () => {
    render(<OfflinePage />)
    expect(screen.getByRole('heading', { level: 1, name: 'You are offline' })).toBeInTheDocument()
  })

  it('tells the user the data is safe on the phone', () => {
    render(<OfflinePage />)
    expect(screen.getByText(/safe on this phone/)).toBeInTheDocument()
  })

  it('tells the user the upload happens on its own', () => {
    render(<OfflinePage />)
    expect(screen.getByText(/uploads it on its own/)).toBeInTheDocument()
  })

  it('offers a way back to today', () => {
    render(<OfflinePage />)
    expect(screen.getByRole('link', { name: 'Back to today' })).toHaveAttribute('href', '/')
  })

  it('sets the heading at the screen title size', () => {
    render(<OfflinePage />)
    const title = screen.getByRole('heading', { level: 1, name: 'You are offline' })
    expect(title).toHaveClass('text-[23px]', 'font-bold', 'tracking-[-0.6px]')
  })

  it('draws the message on the shared card', () => {
    render(<OfflinePage />)
    const card = screen.getByRole('heading', { level: 1 }).closest('div')
    expect(card).toHaveClass('rounded-card', 'bg-surface', 'border-border', 'p-4')
    expect(card).not.toHaveClass('p-6')
  })

  it('draws the way back in the primary button shape, at least 54 px tall', () => {
    render(<OfflinePage />)
    const link = screen.getByRole('link', { name: 'Back to today' })
    expect(link).toHaveClass('min-h-[54px]', 'text-[15px]', 'font-bold', 'border-accent', 'px-4')
    expect(link).not.toHaveClass('h-[54px]')
  })

  it('titles the page', () => {
    expect(metadata.title).toBe('Offline — Gym Tracker')
  })
})
