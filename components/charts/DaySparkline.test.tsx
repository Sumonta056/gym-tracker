import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { barTop, dayLetter, DaySparkline, lineRange, slotCentre, spokenDay } from './DaySparkline'

import type { SparkPoint } from './DaySparkline'

const DATES = [
  '2026-10-10',
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
]

function series(values: (number | null)[]): SparkPoint[] {
  return DATES.map((date, index) => ({ date, value: values[index] ?? null }))
}

const STEPS = series([7200, 9100, null, 10800, 0, 9800, 12000])

function count(value: number): string {
  return value.toLocaleString('en-GB')
}

describe('dayLetter', () => {
  it('returns the first letter of the weekday', () => {
    expect(dayLetter('2026-10-12')).toBe('M')
  })
})

describe('spokenDay', () => {
  it('names the last day Today', () => {
    expect(spokenDay('2026-10-16', true)).toBe('Today')
  })

  it('names an earlier day by weekday and date', () => {
    expect(spokenDay('2026-10-12', false)).toBe('Mon 12')
  })
})

describe('barTop', () => {
  it('leaves headroom over the highest value', () => {
    expect(barTop(series([100, 200]), null)).toBeCloseTo(220)
  })

  it('leaves headroom over a goal above every value', () => {
    expect(barTop(series([100, 200]), 1000)).toBeCloseTo(1100)
  })
})

describe('lineRange', () => {
  it('pads a flat line by 0.4 on each side', () => {
    expect(lineRange([80, 80])).toEqual({ low: 79.6, high: 80.4 })
  })

  it('pads a wide line by a quarter of its span', () => {
    expect(lineRange([70, 80])).toEqual({ low: 67.5, high: 82.5 })
  })
})

describe('slotCentre', () => {
  it('puts a point at the centre of its slot', () => {
    expect(slotCentre(0, 7)).toBeCloseTo(100 / 14)
  })
})

describe('DaySparkline', () => {
  it('draws one bar per logged day and a ghost for a missing or zero day', () => {
    render(
      <DaySparkline name="Steps" points={STEPS} variant="bars" tone="cyan" formatValue={count} />,
    )
    expect(screen.getAllByTestId('spark-bar')).toHaveLength(5)
    expect(screen.getAllByTestId('spark-ghost')).toHaveLength(2)
  })

  it('draws today at full strength and the earlier days faded', () => {
    render(
      <DaySparkline name="Steps" points={STEPS} variant="bars" tone="warn" formatValue={count} />,
    )
    const bars = screen.getAllByTestId('spark-bar')
    expect(bars.at(-1)).toHaveClass('bg-warn')
    expect(bars[0]).toHaveClass('bg-warn/30')
  })

  it('sets each bar height as a share of the top', () => {
    render(
      <DaySparkline
        name="Steps"
        points={series([null, null, null, null, null, null, 1000])}
        variant="bars"
        tone="cyan"
        formatValue={count}
        goal={1000}
      />,
    )
    expect(screen.getByTestId('spark-bar').style.height).toMatch(/^90\.9/)
  })

  it('draws a dashed goal line when a goal is set', () => {
    render(
      <DaySparkline
        name="Steps"
        points={STEPS}
        variant="bars"
        tone="cyan"
        formatValue={count}
        goal={6000}
      />,
    )
    expect(screen.getByTestId('spark-goal')).toHaveClass('border-dashed')
  })

  it('draws no goal line without a goal', () => {
    render(
      <DaySparkline name="Steps" points={STEPS} variant="bars" tone="cyan" formatValue={count} />,
    )
    expect(screen.queryByTestId('spark-goal')).toBeNull()
  })

  it('labels the days by weekday letter and the last as Today', () => {
    const { container } = render(
      <DaySparkline name="Steps" points={STEPS} variant="bars" tone="cyan" formatValue={count} />,
    )
    const labels = container.querySelectorAll('[aria-hidden="true"] .grid-cols-7 > span')
    expect(Array.from(labels, (label) => label.textContent).slice(-2)).toEqual(['T', 'Today'])
  })

  it('lists the 7 values and the goal as a text alternative', () => {
    render(
      <DaySparkline
        name="Steps"
        points={STEPS}
        variant="bars"
        tone="cyan"
        formatValue={count}
        goal={6000}
      />,
    )
    const list = screen.getByRole('list', { name: 'Steps, the last 7 days' })
    const items = within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(items).toHaveLength(8)
    expect(items[2]).toBe('Mon 12: not logged')
    expect(items[6]).toBe('Today: 12,000')
    expect(items[7]).toBe('Goal: 6,000')
  })

  it('draws a line variant with a dot per logged day and today larger', () => {
    render(
      <DaySparkline
        name="Weight"
        points={series([null, 80.6, null, 80.4, null, null, 80])}
        variant="line"
        tone="violet"
        formatValue={String}
      />,
    )
    const dots = screen.getAllByTestId('spark-dot')
    expect(dots).toHaveLength(3)
    expect(dots.at(-1)).toHaveAttribute('data-today', 'true')
    expect(dots.at(-1)).toHaveClass('bg-data-violet')
    expect(dots[0]).toHaveClass('bg-surface')
  })

  it('draws the line through every logged day', () => {
    const { container } = render(
      <DaySparkline
        name="Weight"
        points={series([null, 80.6, null, 80.4, null, null, 80])}
        variant="line"
        tone="violet"
        formatValue={String}
      />,
    )
    const path = container.querySelector('path')?.getAttribute('d') ?? ''
    expect(path.match(/[ML]/g)).toEqual(['M', 'L', 'L'])
  })

  it('fills the width of its container with no fixed pixel width', () => {
    render(
      <DaySparkline name="Steps" points={STEPS} variant="bars" tone="cyan" formatValue={count} />,
    )
    expect(screen.getByTestId('day-sparkline').getAttribute('style')).toBeNull()
  })
})
