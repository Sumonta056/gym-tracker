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
})
