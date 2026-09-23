import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import { AXIS_TICKS, RANGE_TICKS, svgTexts, VALUE_LABELS } from '../../tests/fixtures/recharts'

import { analyse } from './rangeData'
import {
  daysInUnit,
  weightLabel,
  weightLegend,
  weightRows,
  weightSummary,
  WeightChart,
} from './WeightChart'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const empty = analyse([], [], 'week', TODAY, NOW, 12000)
const entries = [
  entryOn('2026-09-21', { weight_kg: 74.1 }),
  entryOn('2026-09-22', { weight_kg: 73.9 }),
  entryOn(TODAY, { weight_kg: 73.4 }),
]
const full = analyse(entries, entries, 'week', TODAY, NOW, 12000)
const imperial = [entryOn('2026-09-22', { weight_kg: 71 }), entryOn(TODAY, { weight_kg: 70 })]
const inPounds = analyse(imperial, imperial, 'week', TODAY, NOW, 12000, 'imperial')
const one = analyse([entryOn(TODAY, { weight_kg: 73.4 })], [], 'week', TODAY, NOW, 12000)

describe('WeightChart', () => {
  it('shows its empty state for an empty series, without throwing', () => {
    render(<WeightChart days={empty.days} tab="week" />)
    expect(screen.getByText('Log a weight to see the trend and its 7-day average.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('names the weights, the average trend and its last value in its label', () => {
    render(<WeightChart days={full.days} tab="week" />)
    expect(
      screen.getByRole('img', {
        name: 'Weight per day: 74.1, 73.9, 73.4 kilograms. Seven day average falling, 73.8 on the last day.',
      }),
    ).toBeInTheDocument()
  })

  it('draws the daily weight and the seven day average as two lines', () => {
    const { container } = render(<WeightChart days={full.days} tab="week" />)
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(2)
  })

  it('writes the last value at the end of each line', () => {
    const { container } = render(<WeightChart days={full.days} tab="week" />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['73.4', '73.8'])
  })

  it('writes the lowest and highest weight at the left', () => {
    const { container } = render(<WeightChart days={full.days} tab="week" />)
    expect(svgTexts(container, RANGE_TICKS)).toEqual(['73.4', '74.1'])
  })

  it('writes a single range label when every weight is the same', () => {
    const flat = [entryOn('2026-09-21', { weight_kg: 73 }), entryOn(TODAY, { weight_kg: 73 })]
    const data = analyse(flat, [], 'week', TODAY, NOW, 12000)
    const { container } = render(<WeightChart days={data.days} tab="week" />)
    expect(svgTexts(container, RANGE_TICKS)).toEqual(['73.0'])
  })

  it('labels the week days under the lines', () => {
    const { container } = render(<WeightChart days={full.days} tab="week" />)
    expect(svgTexts(container, AXIS_TICKS)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('shows the latest weight and the change over the week', () => {
    render(<WeightChart days={full.days} tab="week" />)
    expect(screen.getByText('73.4 kg · −0.7 this week')).toBeVisible()
  })

  it('shows a legend for both lines', () => {
    render(<WeightChart days={full.days} tab="week" />)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Weight',
      '7-day average',
    ])
  })

  it('names the weights in pounds when the profile is imperial', () => {
    render(<WeightChart days={inPounds.days} tab="week" unit={inPounds.unitSystem} />)
    expect(
      screen.getByRole('img', {
        name: 'Weight per day: 156.5, 154.3 pounds. Seven day average falling, 155.4 on the last day.',
      }),
    ).toBeInTheDocument()
  })

  it('shows the latest weight and the change in pounds when the profile is imperial', () => {
    render(<WeightChart days={inPounds.days} tab="week" unit="imperial" />)
    expect(screen.getByText('154.3 lb · −2.2 this week')).toBeVisible()
  })

  it('writes the one logged weight in pounds when the profile is imperial', () => {
    render(<WeightChart days={one.days} tab="week" unit="imperial" />)
    expect(screen.getAllByText('161.8', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('lb').length).toBeGreaterThan(0)
  })

  it('shows the latest weight and the not enough data hint for one logged day', () => {
    const { container } = render(<WeightChart days={one.days} tab="week" />)
    expect(screen.getByText('Log one more day to see a trend.')).toBeVisible()
    expect(screen.getAllByText('73.4', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(0)
  })
})

describe('weightSummary', () => {
  it('is empty for no weight', () => {
    expect(weightSummary([], 'day')).toBe('')
  })

  it('shows only the latest weight for a single day', () => {
    expect(weightSummary([73.4], 'day')).toBe('73.4 kg')
  })
})

describe('weightLabel', () => {
  it('lists every weight to one decimal', () => {
    expect(weightLabel([73.44, 73.5], [73.44, 73.47])).toBe(
      'Weight per day: 73.4, 73.5 kilograms. Seven day average rising, 73.5 on the last day.',
    )
  })

  it('leaves the average out when fewer than two averages are drawn', () => {
    expect(weightLabel([73.4], [73.4])).toBe('Weight per day: 73.4 kilograms.')
  })
})

describe('weightLegend', () => {
  it('names only the daily line when the average is not drawn', () => {
    expect(weightLegend([73.4]).map((item) => item.name)).toEqual(['Weight'])
  })
})

describe('daysInUnit', () => {
  it('leaves kilograms untouched for metric', () => {
    expect(daysInUnit(full.days, 'metric')).toEqual(full.days)
  })

  it('converts the weight and its average to pounds and keeps a gap a gap', () => {
    const days = daysInUnit(inPounds.days, 'imperial')
    expect(days[0]?.weightKg).toBeNull()
    expect(days[1]?.weightKg).toBeCloseTo(156.53, 2)
    expect(days[1]?.averageKg).toBeCloseTo(156.53, 2)
  })
})

describe('weightRows', () => {
  it('carries an end label only on the last day with a value', () => {
    const rows = weightRows(full.days)
    expect(rows.map((row) => row.weightEnd)).toEqual([null, null, '73.4', null, null, null, null])
  })
})
