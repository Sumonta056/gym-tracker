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

  it('reports a value over the goal as 100, inside its own range', () => {
    render(<StatCard label="Steps" value="15,000" progress={1.25} />)
    const bar = screen.getByRole('progressbar', { name: 'Steps progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '100')
  })

  it('reports a negative progress as 0', () => {
    render(<StatCard label="Steps" value="0" progress={-0.2} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('draws the progress bar 5 px tall, as the recipe says', () => {
    render(<StatCard label="Steps" value="8,240" progress={0.62} />)
    expect(screen.getByRole('progressbar')).toHaveClass('h-[5px]')
  })

  it('sets the number at weight 700 with the recipe tracking', () => {
    render(<StatCard label="Weight" value="103.40" unit="kg" />)
    const row = screen.getByText('103.40').parentElement
    expect(row).toHaveClass('font-bold', 'tracking-[-0.9px]')
    expect(row).not.toHaveClass('font-extrabold')
  })

  it('lets a long value wrap its unit inside the card instead of spilling out', () => {
    render(<StatCard label="Weight" value="103.40" unit="kg" />)
    const row = screen.getByText('103.40').parentElement
    expect(row).toHaveClass('flex-wrap', 'min-w-0')
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
