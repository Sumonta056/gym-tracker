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

  it('titles the page', () => {
    expect(metadata.title).toBe('Offline — Gym Tracker')
  })
})
