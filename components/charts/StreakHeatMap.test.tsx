import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'

import { analyse } from './rangeData'
import {
  cellClass,
  days,
  heatMapLabel,
  recentDays,
  StreakHeatMap,
  WEEKDAY_LABELS,
} from './StreakHeatMap'

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
})

describe('StreakHeatMap grid', () => {
  it('labels the 7 rows Mon to Sun, Monday first', () => {
    const { container } = render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    expect(
      Array.from(container.querySelectorAll('[data-weekday-label]'), (node) => node.textContent),
    ).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('draws 84 square cells', () => {
    const { container } = render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    const cells = container.querySelectorAll('[data-state]')
    expect(cells).toHaveLength(84)
    for (const cell of cells) {
      expect(cell).toHaveClass('aspect-square')
    }
  })

  it('outlines a future day so it stays visible', () => {
    const { container } = render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    const future = container.querySelector('[data-state="future"]')
    expect(future).toHaveClass('border-dashed', 'border-dim')
    expect(future).not.toHaveClass('bg-dim')
  })

  it('names the 3 states in the legend', () => {
    render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    const legend = screen.getAllByRole('list')[0] as HTMLElement
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Logged', 'Not logged', 'Ahead'])
  })
})

describe('cellClass', () => {
  it('fills a logged day with the accent', () => {
    expect(cellClass('logged')).toBe('bg-accent')
  })

  it('fills a missed day with the dim token', () => {
    expect(cellClass('missed')).toBe('bg-dim')
  })
})

describe('WEEKDAY_LABELS', () => {
  it('runs from Monday to Sunday', () => {
    expect(WEEKDAY_LABELS).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
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

describe('recentDays', () => {
  it('takes the last 7 days up to today and no future day', () => {
    const days = recentDays(full.heatMap)
    expect(days).toHaveLength(7)
    expect(days.at(-1)?.date).toBe(TODAY)
    expect(days.every((cell) => cell.state !== 'future')).toBe(true)
  })
})

describe('StreakHeatMap day links', () => {
  it('links the last 7 days to the log, outside the chart image', () => {
    render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    const list = screen.getByRole('list', { name: 'Open a day' })
    const links = within(list).getAllByRole('link')
    expect(links).toHaveLength(7)
    expect(links.at(-1)).toHaveAttribute('href', `/log?date=${TODAY}`)
    expect(links.at(-1)).toHaveAccessibleName(/, logged$/)
    for (const link of links) {
      expect(link).toHaveClass('min-h-11')
      expect(screen.getByRole('img').contains(link)).toBe(false)
    }
  })

  it('shows no day links while the heat map is empty', () => {
    render(<StreakHeatMap weeks={empty.heatMap} streak={empty.streak} />)
    expect(screen.queryByRole('list', { name: 'Open a day' })).not.toBeInTheDocument()
  })
})
