import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'
import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'

import { analyse } from './rangeData'
import { cellFill, days, heatMapLabel, StreakHeatMap } from './StreakHeatMap'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const empty = analyse([], [], 'week', TODAY, NOW, 12000)
const logged = ['2026-09-21', '2026-09-22', TODAY].map((date) => entryOn(date))
const full = analyse(logged, logged, 'week', TODAY, NOW, 12000)

describe('StreakHeatMap', () => {
  it('shows its empty state for an empty series, without throwing', () => {
    render(<StreakHeatMap weeks={empty.heatMap} streak={empty.streak} />)
    expect(screen.getByText('Log a day to start a streak.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('names the streak from lib/metrics/streak in its label', () => {
    render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    expect(
      screen.getByRole('img', {
        name: 'Streak over the last 12 weeks: logged 3 of 80 days. Current streak 3 days, longest 3 days.',
      }),
    ).toBeInTheDocument()
  })

  it('shows the current and the longest streak beside the title', () => {
    render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    expect(screen.getByText('3 days · longest 3 days')).toBeVisible()
  })

  it('draws one cell per day of the twelve weeks', () => {
    const { container } = render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(84)
  })
})

describe('cellFill', () => {
  it('fills a logged day with the accent', () => {
    expect(cellFill(full.heatMap, 11, 0)).toBe(colorTokens.accent)
  })

  it('fills a missed day with the dim token, at 3:1 or better against the card', () => {
    expect(cellFill(full.heatMap, 0, 0)).toBe(colorTokens.dim)
  })

  it('fills a future day, or a cell outside the map, with the card surface', () => {
    expect(cellFill(full.heatMap, 11, 6)).toBe(colorTokens.surface)
    expect(cellFill(full.heatMap, 99, 0)).toBe(colorTokens.surface)
  })
})

describe('days', () => {
  it('writes one day in the singular', () => {
    expect(days(1)).toBe('1 day')
  })

  it('writes zero days in the plural', () => {
    expect(days(0)).toBe('0 days')
  })
})

describe('heatMapLabel', () => {
  it('counts no future day', () => {
    expect(heatMapLabel(empty.heatMap, { current: 0, longest: 0 })).toBe(
      'Streak over the last 12 weeks: logged 0 of 80 days. Current streak 0 days, longest 0 days.',
    )
  })
})
