import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'
import { AXIS_TICKS, REFERENCE_LABELS, svgTexts, VALUE_LABELS } from '../../tests/fixtures/recharts'

import {
  CaloriesPerMinuteChart,
  ratePlacement,
  ratePoints,
  rateRows,
  rateScale,
} from './CaloriesPerMinuteChart'

import type { DayPoint } from './rangeData'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

function day(date: string, gymSeconds: number | null, calories: number | null): DayPoint {
  return {
    date,
    logged: true,
    weightKg: null,
    averageKg: null,
    calories,
    steps: null,
    avgHeartRate: null,
    maxHeartRate: null,
    gymSeconds,
  }
}

function blank(date: string): DayPoint {
  return { ...day(date, null, null), logged: false }
}

const PLATE = [
  day('2026-09-02', 3600, 804),
  day('2026-09-03', 3600, 726),
  blank('2026-09-04'),
  day('2026-09-06', 3600, 834),
  day('2026-09-09', null, 629),
  day('2026-09-12', 3600, 798),
  day('2026-09-13', 3600, 852),
]

describe('CaloriesPerMinuteChart', () => {
  it('shows its empty state before any session exists', () => {
    render(<CaloriesPerMinuteChart days={[blank('2026-09-13')]} />)
    expect(
      screen.getByText('Log the gym time and the calories burnt to see the calories a gym minute.'),
    ).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the empty state for a day with calories and no gym time', () => {
    render(<CaloriesPerMinuteChart days={[day('2026-09-09', null, 629)]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/Log the gym time/)).toBeVisible()
  })

  it('shows the latest value and the hint with one session, never a lone dot', () => {
    render(<CaloriesPerMinuteChart days={[day('2026-09-13', 3600, 852)]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Log one more session to see a trend.')).toBeVisible()
    expect(screen.getByText('kcal a min', { exact: false })).toBeVisible()
    expect(screen.getByText('14.2 last session')).toBeVisible()
  })

  it('draws one line from the sessions with gym time, with its end label and average', () => {
    const { container } = render(<CaloriesPerMinuteChart days={PLATE} />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['14.2'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['avg 13.4'])
    expect(svgTexts(container, AXIS_TICKS)).toEqual(['Wed 2', 'Thu 3', 'Sun 6', 'Sat 12', 'Sun 13'])
    expect(container.querySelector('.recharts-line-curve')?.getAttribute('stroke')).toBe(
      colorTokens.warn,
    )
    expect(screen.getByText('kcal ÷ gym minutes')).toBeVisible()
  })

  it('states the rates and the average in its text alternative', () => {
    render(<CaloriesPerMinuteChart days={PLATE} />)
    expect(
      screen.getByRole('img', {
        name: 'Calories per gym minute per session, rising: 13.4, 12.1, 13.9, 13.3, 14.2. Average 13.4.',
      }),
    ).toBeInTheDocument()
  })
})

describe('the calorie rate helpers', () => {
  it('takes every logged row and drops a row with no gym time', () => {
    expect(ratePoints(PLATE).map((point) => point.date)).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-06',
      '2026-09-12',
      '2026-09-13',
    ])
  })

  it('marks only the last row with an end label', () => {
    expect(rateRows(ratePoints(PLATE)).map((row) => row.end)).toEqual([
      null,
      null,
      null,
      null,
      '14.2',
    ])
  })

  it('pads the scale by a fifth of the spread, at least half a unit', () => {
    expect(rateScale([10, 20])).toEqual({ low: 8, high: 22 })
    expect(rateScale([12, 12])).toEqual({ low: 11.5, high: 12.5 })
  })

  it('puts the average label below the line when the last value sits well above it', () => {
    expect(ratePlacement(14, 12, { low: 10, high: 15 }, 120)).toBe('below')
  })

  it('puts the average label above the line when the last value sits well below it', () => {
    expect(ratePlacement(11, 13, { low: 10, high: 15 }, 120)).toBe('above')
  })

  it('moves the average label to the band when the last value sits near the line', () => {
    expect(ratePlacement(12.1, 12, { low: 10, high: 15 }, 120)).toBe('band')
  })

  it('moves the label to the band when below would reach the day labels', () => {
    expect(ratePlacement(15, 10.2, { low: 10, high: 15 }, 120)).toBe('band')
  })
})
