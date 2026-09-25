import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import { REFERENCE_LABELS, svgTexts, VALUE_LABELS } from '../../tests/fixtures/recharts'

import { caloriesLabel, CaloriesChart } from './CaloriesChart'
import { analyse } from './rangeData'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const empty = analyse([], [], 'week', TODAY, NOW, 12000)
const entries = [
  entryOn('2026-09-21', { calories_burnt: 620 }),
  entryOn('2026-09-22', { calories_burnt: 780 }),
  entryOn(TODAY, { calories_burnt: 410 }),
]
const full = analyse(entries, entries, 'week', TODAY, NOW, 12000)
const one = analyse([entryOn(TODAY, { calories_burnt: 705 })], [], 'week', TODAY, NOW, 12000)

describe('CaloriesChart', () => {
  it('shows its empty state for an empty series, without throwing', () => {
    render(<CaloriesChart days={empty.days} tab="week" />)
    expect(screen.getByText('Log the calories burnt to see them per day.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('names the trend, the total and the average in its label', () => {
    render(<CaloriesChart days={full.days} tab="week" />)
    expect(
      screen.getByRole('img', {
        name: 'Calories per day, falling: 620, 780, 410 kcal. Total 1,810 kcal. Average 603 kcal a day.',
      }),
    ).toBeInTheDocument()
  })

  it('shows the total beside the title', () => {
    render(<CaloriesChart days={full.days} tab="week" />)
    expect(screen.getByText('1,810 total')).toBeVisible()
  })

  it('writes the value above every bar and an average line over the logged days', () => {
    const { container } = render(<CaloriesChart days={full.days} tab="week" />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['620', '780', '410'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['avg 603'])
  })

  it('draws one labelled bar and no average line for one logged day', () => {
    const { container } = render(<CaloriesChart days={one.days} tab="week" />)
    expect(
      screen.getByRole('img', {
        name: 'Calories per day, one day logged: 705 kcal. Total 705 kcal.',
      }),
    ).toBeInTheDocument()
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['705'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual([])
  })
})

describe('caloriesLabel', () => {
  it('rounds the average to a whole kcal', () => {
    expect(caloriesLabel([620, 780], 705.7)).toBe(
      'Calories per day, rising: 620, 780 kcal. Total 1,400 kcal. Average 706 kcal a day.',
    )
  })
})
