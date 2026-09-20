import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders the micro label and the value', () => {
    render(<StatCard label="Steps" value="8,240" />)
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.getByText('8,240')).toBeInTheDocument()
  })

  it('renders an optional unit and hint', () => {
    render(<StatCard label="Weight" value="82.4" unit="kg" hint="7 day average" />)
    expect(screen.getByText('kg')).toBeInTheDocument()
    expect(screen.getByText('7 day average')).toBeInTheDocument()
  })

  it('renders a progress bar with an accessible value', () => {
    render(<StatCard label="Steps" value="8,240" progress={0.62} />)
    const bar = screen.getByRole('progressbar', { name: 'Steps progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '62')
  })

  it('renders a sparkline with a text alternative', () => {
    render(<StatCard label="Volume" value="12,400" sparkline={[1, 4, 2, 6]} tone="cyan" />)
    expect(screen.getByText('Volume series: 1, 4, 2, 6')).toBeInTheDocument()
  })

  it('handles a flat sparkline series without dividing by zero', () => {
    render(<StatCard label="Volume" value="0" sparkline={[3, 3, 3]} />)
    expect(screen.getByText('Volume series: 3, 3, 3')).toBeInTheDocument()
  })

  it('renders neither a bar nor a sparkline by default', () => {
    render(<StatCard label="Steps" value="8,240" />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
