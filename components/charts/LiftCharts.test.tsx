import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TODAY } from '../../tests/fixtures/dashboard'
import { BENCH, EXERCISES, LAT, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import { LiftCharts } from './LiftCharts'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const monday = sessionOn('2026-09-21')
const today = sessionOn(TODAY)

describe('LiftCharts', () => {
  it('shows the empty state of every card before any session exists', () => {
    render(
      <LiftCharts
        source={{ sessions: [], sets: [], exercises: EXERCISES }}
        tab="week"
        today={TODAY}
      />,
    )
    const grid = screen.getByTestId('lift-grid')

    expect(within(grid).getAllByRole('heading', { level: 2 })).toHaveLength(3)
    expect(within(grid).queryByRole('img')).not.toBeInTheDocument()
  })

  it('lays the cards out in one column, and two from the md breakpoint', () => {
    render(
      <LiftCharts
        source={{ sessions: [], sets: [], exercises: EXERCISES }}
        tab="week"
        today={TODAY}
      />,
    )
    expect(screen.getByTestId('lift-grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2')
  })

  it('renders with one session: one bar, no lone dot and one record each', () => {
    render(
      <LiftCharts
        source={{
          sessions: [today],
          sets: [liftSet(today, BENCH, 8, 45), liftSet(today, LAT, 12, 35)],
          exercises: EXERCISES,
        }}
        tab="week"
        today={TODAY}
      />,
    )
    const grid = screen.getByTestId('lift-grid')

    expect(within(grid).getAllByRole('img')).toHaveLength(1)
    expect(within(grid).getByText('Log one more session to see a trend.')).toBeVisible()
    const records = within(grid)
      .getByRole('heading', { name: 'Personal records' })
      .closest('div.rounded-card')
    expect(records).not.toBeNull()
    expect(within(records as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
  })

  it('draws both charts with two sessions, each with a full-width container', () => {
    const { container } = render(
      <LiftCharts
        source={{
          sessions: [monday, today],
          sets: [liftSet(monday, BENCH, 8, 45), liftSet(today, BENCH, 8, 47.5)],
          exercises: EXERCISES,
        }}
        tab="week"
        today={TODAY}
      />,
    )

    const images = within(screen.getByTestId('lift-grid')).getAllByRole('img')
    expect(images).toHaveLength(2)
    for (const image of container.querySelectorAll('[role="img"]')) {
      expect(image).toHaveClass('w-full')
      expect(image).toHaveAccessibleName()
    }
  })
})
