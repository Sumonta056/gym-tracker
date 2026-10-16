import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DeltaChip } from './DeltaChip'

describe('DeltaChip', () => {
  it('shows an up arrow in the ok token with the words', () => {
    render(<DeltaChip direction="up" text="3,400 vs 6-day avg" />)
    expect(screen.getByText('▲')).toHaveClass('text-ok')
    expect(screen.getByText('3,400 vs 6-day avg')).toBeInTheDocument()
  })

  it('shows a down arrow in the warn token', () => {
    render(<DeltaChip direction="down" text="120 vs 6-day avg" />)
    expect(screen.getByText('▼')).toHaveClass('text-warn')
  })

  it('shows an equals sign in the muted token for the same value', () => {
    render(<DeltaChip direction="same" text="same as 6-day avg" />)
    expect(screen.getByText('=')).toHaveClass('text-muted')
  })

  it('hides the arrow and says the direction in words for a screen reader', () => {
    render(<DeltaChip direction="down" text="0.4 kg since Tue" />)
    expect(screen.getByText('▼')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Down')).toHaveClass('sr-only')
  })

  it('adds no direction word for the same value', () => {
    const { container } = render(<DeltaChip direction="same" text="same as 6-day avg" />)
    expect(container.querySelector('.sr-only')).toBeNull()
  })
})
