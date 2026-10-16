import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NOW, TODAY } from '../../tests/fixtures/dashboard'

import { analyse } from './rangeData'
import { moveCard, resolveLayout, setHidden, STATS_CARD_IDS } from './statsCards'
import { ALL_HIDDEN, StatsGrid } from './StatsGrid'

import type { StatsCardContext } from './StatsCard'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const DAILY: StatsCardContext = {
  daily: analyse([], [], 'week', TODAY, NOW, 12000),
  lifts: null,
  week: null,
}

function headings(): (string | null)[] {
  return within(screen.getByTestId('stats-grid'))
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent)
}

describe('StatsGrid', () => {
  it('renders only the shown cards, in layout order', () => {
    const layout = setHidden(moveCard(resolveLayout(null), 'calories', -1), 'steps', true)
    render(<StatsGrid layout={layout} context={DAILY} />)
    expect(headings().slice(0, 3)).toEqual(['Calories burnt', 'Weight', 'Walk'])
    expect(headings()).not.toContain('Steps')
  })

  it('says every card is hidden when none is shown', () => {
    const layout = STATS_CARD_IDS.map((id) => ({ id, hidden: true }))
    render(<StatsGrid layout={layout} context={DAILY} />)
    expect(screen.getByText(ALL_HIDDEN)).toBeVisible()
    expect(screen.queryByTestId('stats-grid')).not.toBeInTheDocument()
  })

  it('lays the cards out in one column, two from md, and never three', () => {
    render(<StatsGrid layout={resolveLayout(null)} context={DAILY} />)
    const grid = screen.getByTestId('stats-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2')
    expect(grid).not.toHaveClass('lg:grid-cols-3')
  })

  it('renders the 8 daily cards only when the lift and week inputs are missing', () => {
    render(<StatsGrid layout={resolveLayout(null)} context={DAILY} />)
    expect(screen.getByTestId('stats-grid').children).toHaveLength(8)
  })

  it('takes its test id from the caller', () => {
    render(<StatsGrid layout={resolveLayout(null)} context={DAILY} testId="other-grid" />)
    expect(screen.getByTestId('other-grid')).toBeInTheDocument()
  })
})
