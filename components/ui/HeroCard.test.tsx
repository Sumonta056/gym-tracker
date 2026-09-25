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

  it('pads at the recipe: 16 px on top and the sides, 20 px at the foot', () => {
    render(<HeroCard data-testid="hero">1h 12m</HeroCard>)
    const hero = screen.getByTestId('hero')
    expect(hero).toHaveClass('p-4', 'pb-5')
    expect(hero).not.toHaveClass('p-5')
  })

  it('uses the accent fill, accent ink and hero radius tokens', () => {
    render(<HeroCard data-testid="hero">1h 12m</HeroCard>)
    const hero = screen.getByTestId('hero')
    expect(hero).toHaveClass('bg-accent')
    expect(hero).toHaveClass('text-accent-ink')
    expect(hero).toHaveClass('rounded-hero')
  })
})
