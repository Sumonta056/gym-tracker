import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Card } from './Card'

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Bench press</Card>)
    expect(screen.getByText('Bench press')).toBeInTheDocument()
  })

  it('uses the surface, border and card radius tokens', () => {
    render(<Card data-testid="card">Bench press</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('bg-surface')
    expect(card).toHaveClass('border-border')
    expect(card).toHaveClass('rounded-card')
  })

  it('swaps the border to accent when selected', () => {
    render(
      <Card data-testid="card" selected>
        Bench press
      </Card>,
    )
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('border-accent')
    expect(card).not.toHaveClass('border-border')
  })

  it('mixes the cyan data token into the fill and the border in the rest tone', () => {
    render(
      <Card data-testid="card" tone="rest">
        Rest
      </Card>,
    )
    const card = screen.getByTestId('card')
    expect(card).toHaveAttribute('data-tone', 'rest')
    expect(card.className).toContain('var(--color-data-cyan)_7%,var(--color-surface)')
    expect(card.className).toContain('var(--color-data-cyan)_34%,var(--color-border)')
    expect(card).not.toHaveClass('bg-surface')
    expect(card).not.toHaveClass('border-border')
  })

  it('keeps the accent border when a rest card is selected', () => {
    render(
      <Card data-testid="card" tone="rest" selected>
        Rest
      </Card>,
    )
    expect(screen.getByTestId('card')).toHaveClass('border-accent')
  })
})
