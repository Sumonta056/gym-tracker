import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataCard } from './DataCard'

describe('DataCard', () => {
  it('offers the import and the export as real buttons', () => {
    render(<DataCard />)
    expect(screen.getByRole('button', { name: 'Import the Excel CSV' })).toHaveAttribute(
      'type',
      'button',
    )
    expect(screen.getByRole('button', { name: 'Export everything as CSV' })).toBeInTheDocument()
  })

  it('keeps both inert until Phase 2 and says so', () => {
    render(<DataCard />)
    const button = screen.getByRole('button', { name: 'Import the Excel CSV' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('The CSV import and export arrive in Phase 2.')
  })
})
