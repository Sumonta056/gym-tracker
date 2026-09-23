import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import { REFERENCE_LABELS, svgTexts, VALUE_LABELS } from '../../tests/fixtures/recharts'

import { analyse } from './rangeData'
import { isEmptyTotals, minutes, totalsLabel, TotalsChart } from './TotalsChart'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const empty = analyse([], [], 'week', TODAY, NOW, 12000)
const entries = [
  entryOn('2026-09-21', { gym_seconds: 3600, calories_burnt: 600, steps: 9000 }),
  entryOn('2026-09-22', { gym_seconds: null, calories_burnt: 100, steps: 1000 }),
  entryOn(TODAY, { gym_seconds: 1800, calories_burnt: 300, steps: 2000 }),
]
const full = analyse(entries, entries, 'week', TODAY, NOW, 12000)
const one = analyse([entryOn(TODAY, { gym_seconds: 4325 })], [], 'week', TODAY, NOW, 12000)

describe('TotalsChart', () => {
  it('shows its empty state for an empty series, without throwing', () => {
    render(<TotalsChart days={empty.days} totals={empty.totals} tab="week" />)
    expect(screen.getByText('Nothing logged this week yet.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('names the totals and the average in its label', () => {
    render(<TotalsChart days={full.days} totals={full.totals} tab="week" />)
    expect(
      screen.getByRole('img', {
        name: 'Time in the gym per day this week. Totals: 2 sessions, 1h 30m in the gym, 1,000 kcal, 12,000 steps. Average 30m a logged day.',
      }),
    ).toBeInTheDocument()
  })

  it('reads the totals row outside the chart', () => {
    render(<TotalsChart days={full.days} totals={full.totals} tab="week" />)
    for (const value of ['2', '1h 30m', '1,000', '12,000']) {
      expect(screen.getByText(value)).toBeVisible()
    }
  })

  it('titles the card by the selected range', () => {
    render(<TotalsChart days={full.days} totals={full.totals} tab="month" />)
    expect(screen.getByRole('heading', { name: 'Month totals' })).toBeInTheDocument()
  })

  it('writes gym time in minutes above each bar, with the average over the logged days', () => {
    const { container } = render(<TotalsChart days={full.days} totals={full.totals} tab="week" />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['60m', '30m'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['avg 30m'])
  })

  it('draws one labelled bar and no average line for one logged day', () => {
    const { container } = render(<TotalsChart days={one.days} totals={one.totals} tab="week" />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['72m'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual([])
  })

  it('draws no average line when the logged days hold no gym time', () => {
    const rest = [
      entryOn('2026-09-21', { gym_seconds: null }),
      entryOn(TODAY, { gym_seconds: null }),
    ]
    const data = analyse(rest, [], 'week', TODAY, NOW, 12000)
    const { container } = render(<TotalsChart days={data.days} totals={data.totals} tab="week" />)
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual([])
  })
})

describe('isEmptyTotals', () => {
  it('is not empty for a walk alone', () => {
    expect(isEmptyTotals({ ...empty.totals, walkSeconds: 60 })).toBe(false)
  })
})

describe('minutes', () => {
  it('writes the seconds as whole minutes through lib/duration', () => {
    expect(minutes(3707)).toBe('62m')
  })
})

describe('totalsLabel', () => {
  it('writes one session in the singular', () => {
    expect(totalsLabel({ ...empty.totals, sessions: 1 }, 'week')).toContain('1 session,')
  })

  it('names the day on the day tab, with no average', () => {
    expect(totalsLabel(empty.totals, 'day')).toBe(
      'Time in the gym per day today. Totals: 0 sessions, 0m in the gym, 0 kcal, 0 steps.',
    )
  })
})
