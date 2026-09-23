import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import { svgTexts, VALUE_LABELS } from '../../tests/fixtures/recharts'

import {
  heartRateLabel,
  heartRateLegend,
  heartRateRows,
  heartRateSummary,
  HeartRateChart,
  latestReading,
} from './HeartRateChart'
import { analyse } from './rangeData'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const empty = analyse([], [], 'week', TODAY, NOW, 12000)
const entries = [
  entryOn('2026-09-21', { avg_heart_rate: 112, max_heart_rate: 158 }),
  entryOn(TODAY, { avg_heart_rate: 118, max_heart_rate: 171 }),
]
const full = analyse(entries, entries, 'week', TODAY, NOW, 12000)
const one = analyse(
  [entryOn(TODAY, { avg_heart_rate: 113, max_heart_rate: 168 })],
  [],
  'week',
  TODAY,
  NOW,
  12000,
)

describe('HeartRateChart', () => {
  it('shows its empty state for an empty series, without throwing', () => {
    render(<HeartRateChart days={empty.days} tab="week" />)
    expect(screen.getByText('Log an average or a peak heart rate to see the trend.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('names both trends and their last values in its label', () => {
    render(<HeartRateChart days={full.days} tab="week" />)
    expect(
      screen.getByRole('img', {
        name: 'Average heart rate 112 to 118 bpm, rising, 118 on the last day. Highest heart rate 158 to 171 bpm, rising, 171 on the last day.',
      }),
    ).toBeInTheDocument()
  })

  it('draws the average and the highest as two lines, each with its end label', () => {
    const { container } = render(<HeartRateChart days={full.days} tab="week" />)
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(2)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['171', '118'])
  })

  it('shows the mean average and the highest peak beside the title', () => {
    render(<HeartRateChart days={full.days} tab="week" />)
    expect(screen.getByText('avg 115 · max 171')).toBeVisible()
  })

  it('shows the latest reading and the not enough data hint for one logged day', () => {
    const { container } = render(<HeartRateChart days={one.days} tab="week" />)
    expect(screen.getByText('Log one more day to see a trend.')).toBeVisible()
    expect(screen.getByText('avg 113 · max 168')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(0)
  })

  it('draws only the line with two points, and names only that line in the legend', () => {
    const mixed = [
      entryOn('2026-09-21', { avg_heart_rate: 112, max_heart_rate: null }),
      entryOn(TODAY, { avg_heart_rate: 118, max_heart_rate: 171 }),
    ]
    const data = analyse(mixed, [], 'week', TODAY, NOW, 12000)
    const { container } = render(<HeartRateChart days={data.days} tab="week" />)
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(1)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Average'])
  })
})

describe('heartRateSummary', () => {
  it('shows only the peak when no average is logged', () => {
    expect(heartRateSummary([], [160])).toBe('max 160')
  })

  it('shows only the average when no peak is logged', () => {
    expect(heartRateSummary([120], [])).toBe('avg 120')
  })
})

describe('heartRateLabel', () => {
  it('names a single reading without a range', () => {
    expect(heartRateLabel([120], [])).toBe('Average heart rate 120 bpm, one day logged.')
  })

  it('names only the peak when no average is logged', () => {
    expect(heartRateLabel([], [160, 150])).toBe(
      'Highest heart rate 150 to 160 bpm, falling, 150 on the last day.',
    )
  })
})

describe('heartRateLegend', () => {
  it('names both lines when both hold two points', () => {
    expect(heartRateLegend([1, 2], [3, 4]).map((item) => item.name)).toEqual(['Highest', 'Average'])
  })
})

describe('heartRateRows', () => {
  it('carries each end label only on the last day with a value', () => {
    const rows = heartRateRows(full.days)
    expect(rows[2]).toMatchObject({ avgEnd: '118', maxEnd: '171' })
    expect(rows[0]).toMatchObject({ avgEnd: null, maxEnd: null })
  })
})

describe('latestReading', () => {
  it('reads only the peak when the latest day has no average', () => {
    const data = analyse(
      [entryOn(TODAY, { avg_heart_rate: null, max_heart_rate: 160 })],
      [],
      'day',
      TODAY,
      NOW,
      12000,
    )
    expect(latestReading(data.days)).toEqual([{ value: '160', unit: 'max' }])
  })

  it('reads nothing when no day holds a heart rate', () => {
    expect(latestReading(empty.days)).toEqual([])
  })
})
