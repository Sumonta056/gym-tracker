import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WeekTotalsCard } from './WeekTotalsCard'

const TOTALS = { sessions: 3, gymSeconds: 9120, walkSeconds: 0, calories: 2627, steps: 21480 }

describe('WeekTotalsCard', () => {
  it('shows the four week totals with their names', () => {
    render(<WeekTotalsCard totals={TOTALS} />)
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'sessions',
      'gym time',
      'kcal',
      'steps',
    ])
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2h 32m')).toBeInTheDocument()
    expect(screen.getByText('2,627')).toBeInTheDocument()
    expect(screen.getByText('21,480')).toBeInTheDocument()
  })

  it('has a heading for the card', () => {
    render(<WeekTotalsCard totals={TOTALS} />)
    expect(screen.getByRole('heading', { level: 2, name: 'This week' })).toBeInTheDocument()
  })
})
