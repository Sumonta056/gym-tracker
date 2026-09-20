import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HeroCard } from './HeroCard'

describe('HeroCard', () => {
  it('renders its children', () => {
    render(<HeroCard>1h 12m</HeroCard>)
    expect(screen.getByText('1h 12m')).toBeInTheDocument()
  })

  it('renders an optional micro label', () => {
    render(<HeroCard label="Gym time">1h 12m</HeroCard>)
    expect(screen.getByText('Gym time')).toBeInTheDocument()
  })

  it('omits the label element when no label is given', () => {
    render(<HeroCard>1h 12m</HeroCard>)
    expect(screen.queryByText('Gym time')).not.toBeInTheDocument()
  })

  it('uses the accent fill, accent ink and hero radius tokens', () => {
    render(<HeroCard data-testid="hero">1h 12m</HeroCard>)
    const hero = screen.getByTestId('hero')
    expect(hero).toHaveClass('bg-accent')
    expect(hero).toHaveClass('text-accent-ink')
    expect(hero).toHaveClass('rounded-hero')
  })
})
