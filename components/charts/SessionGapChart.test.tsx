import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'
import { sessionGaps } from '../../lib/metrics/sessionGaps'
import {
  AXIS_TICKS,
  barFills,
  REFERENCE_LABELS,
  svgTexts,
  VALUE_LABELS,
} from '../../tests/fixtures/recharts'

import {
  bucketTick,
  gapLabel,
  gapRows,
  gapSpan,
  gapSummary,
  SessionGapChart,
} from './SessionGapChart'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const SEPTEMBER = [
  '2026-09-02',
  '2026-09-03',
  '2026-09-06',
  '2026-09-09',
  '2026-09-12',
  '2026-09-13',
]

describe('SessionGapChart', () => {
  it('shows its empty state before any session exists', () => {
    render(<SessionGapChart dates={[]} />)
    expect(screen.getByText('Log a day to start counting the days between sessions.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('asks for one more day with one session, and draws no bar', () => {
    render(<SessionGapChart dates={['2026-09-13']} />)
    expect(screen.getByText('Log one more day to see the days between sessions.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('draws the plate histogram for 2 to 13 September', () => {
    const { container } = render(<SessionGapChart dates={SEPTEMBER} />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['2', '3'])
    expect(svgTexts(container, AXIS_TICKS)).toEqual([
      '1 day',
      '2 days',
      '3 days',
      '4 days',
      '5+ days',
    ])
    expect(screen.getByText('Gaps 1, 3, 3, 3, 1 from 2 to 13 September.')).toBeVisible()
    expect(screen.getByText('avg 2.2 days')).toBeVisible()
  })

  it('fills the gap buckets in violet and the empty buckets as ghost slots', () => {
    const { container } = render(<SessionGapChart dates={SEPTEMBER} />)
    const fills = barFills(container)
    expect(fills.filter((fill) => fill === colorTokens['data-violet'])).toHaveLength(2)
    expect(fills.filter((fill) => fill === colorTokens['surface-2'])).toHaveLength(3)
  })

  it('shows no average line', () => {
    const { container } = render(<SessionGapChart dates={SEPTEMBER} />)
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual([])
    expect(container.querySelector('.recharts-reference-line')).toBeNull()
  })

  it('states the plate numbers in its text alternative', () => {
    render(<SessionGapChart dates={SEPTEMBER} />)
    expect(
      screen.getByRole('img', {
        name: 'Days between sessions, 2 to 13 September: a gap of 1 day twice, 3 days three times, no gap of 2, 4 or 5 or more days. Average gap 2.2 days.',
      }),
    ).toBeInTheDocument()
  })

  it('draws one bar for two sessions, with the gap as its summary', () => {
    const { container } = render(<SessionGapChart dates={['2026-09-09', '2026-09-12']} />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['1'])
    expect(screen.getByText('3.0 days')).toBeVisible()
  })
})

describe('the gap helpers', () => {
  it('names the last bucket 5 or more days', () => {
    expect(bucketTick(1)).toBe('1 day')
    expect(bucketTick(4)).toBe('4 days')
    expect(bucketTick(5)).toBe('5+ days')
  })

  it('spans a month end in words', () => {
    expect(gapSpan(['2026-09-02', '2026-08-30'])).toBe('30 August to 2 September')
  })

  it('reads a long gap, once, and a missing 1 day bucket', () => {
    const { histogram, gaps } = sessionGaps(['2026-09-01', '2026-09-03', '2026-09-10'])
    expect(gapLabel(histogram, gaps, '1 to 10 September')).toBe(
      'Days between sessions, 1 to 10 September: a gap of 2 days once, 5 or more days once, no gap of 1, 3 or 4 days. Average gap 4.5 days.',
    )
  })

  it('says day for a lone missing 1 day bucket', () => {
    const { histogram, gaps } = sessionGaps([
      '2026-09-01',
      '2026-09-03',
      '2026-09-06',
      '2026-09-10',
      '2026-09-15',
    ])
    expect(gapLabel(histogram, gaps, 'x')).toContain('no gap of 1 day.')
  })

  it('leaves out the missing part when every bucket holds a gap', () => {
    const { histogram, gaps } = sessionGaps([
      '2026-09-01',
      '2026-09-02',
      '2026-09-04',
      '2026-09-07',
      '2026-09-11',
      '2026-09-16',
    ])
    expect(gapLabel(histogram, gaps, 'x')).toBe(
      'Days between sessions, x: a gap of 1 day once, 2 days once, 3 days once, 4 days once, 5 or more days once. Average gap 3.0 days.',
    )
  })

  it('keeps every bucket and ghosts the empty ones at the tallest count', () => {
    expect(gapRows(sessionGaps(SEPTEMBER).histogram)).toEqual([
      { bucket: '1 day', value: 2, ghost: null, label: '2' },
      { bucket: '2 days', value: null, ghost: 3, label: null },
      { bucket: '3 days', value: 3, ghost: null, label: '3' },
      { bucket: '4 days', value: null, ghost: 3, label: null },
      { bucket: '5+ days', value: null, ghost: 3, label: null },
    ])
  })

  it('writes a count of ten or more in figures', () => {
    const dates = Array.from(
      { length: 11 },
      (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`,
    )
    expect(gapLabel(sessionGaps(dates).histogram, sessionGaps(dates).gaps, 'x')).toContain(
      'a gap of 1 day 10 times',
    )
  })

  it('writes avg only for two or more gaps', () => {
    expect(gapSummary([3])).toBe('3.0 days')
    expect(gapSummary([1, 3])).toBe('avg 2.0 days')
  })
})
