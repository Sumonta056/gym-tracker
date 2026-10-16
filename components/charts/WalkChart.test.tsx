import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import { REFERENCE_LABELS, svgTexts, VALUE_LABELS } from '../../tests/fixtures/recharts'

import { analyse } from './rangeData'
import { walkLabel, WalkChart } from './WalkChart'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const empty = analyse([], [], 'week', TODAY, NOW, 12000)
const entries = [
  entryOn('2026-09-21', { walk_seconds: 1800 }),
  entryOn('2026-09-22', { walk_seconds: 2700 }),
  entryOn(TODAY, { walk_seconds: 3600 }),
]
const full = analyse(entries, entries, 'week', TODAY, NOW, 12000)
const one = analyse([entryOn(TODAY, { walk_seconds: 1500 })], [], 'week', TODAY, NOW, 12000)

describe('WalkChart', () => {
  it('shows its empty state for an empty series, without throwing', () => {
    render(<WalkChart days={empty.days} tab="week" />)
    expect(screen.getByText('Log your walk time to see it per day.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the total beside the title', () => {
    render(<WalkChart days={full.days} tab="week" />)
    expect(screen.getByText('2h 15m total')).toBeVisible()
  })

  it('writes minutes above each bar, with the average over the logged days', () => {
    const { container } = render(<WalkChart days={full.days} tab="week" />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['30m', '45m', '60m'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['avg 45m'])
  })

  it('draws the goal line instead of the average when a goal is set', () => {
    const { container } = render(<WalkChart days={full.days} tab="week" goalSeconds={3600} />)
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 60m'])
  })

  it('keeps the goal line for one logged day', () => {
    const { container } = render(<WalkChart days={one.days} tab="week" goalSeconds={3600} />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['25m'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 60m'])
  })
})

describe('walkLabel', () => {
  it('names the trend, the values, the total and the goal', () => {
    expect(walkLabel([1800, 2700, 3600], 2700, 3600)).toBe(
      'Walk time per day, rising: 30m, 45m, 60m. Total 2h 15m. Goal 60m a day.',
    )
  })

  it('names the average when there is no goal', () => {
    expect(walkLabel([1800, 3600], 2700, null)).toBe(
      'Walk time per day, rising: 30m, 60m. Total 1h 30m. Average 45m a logged day.',
    )
  })

  it('names neither with 1 logged day and no goal', () => {
    expect(walkLabel([1500], null, null)).toBe('Walk time per day, one day logged: 25m. Total 25m.')
  })
})
