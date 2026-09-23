import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import { REFERENCE_LABELS, svgTexts, VALUE_LABELS } from '../../tests/fixtures/recharts'

import { analyse } from './rangeData'
import { stepsLabel, StepsChart } from './StepsChart'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const empty = analyse([], [], 'week', TODAY, NOW, 12000)
const entries = [entryOn('2026-09-21', { steps: 9120 }), entryOn(TODAY, { steps: 11400 })]
const full = analyse(entries, entries, 'week', TODAY, NOW, 12000)
const one = analyse([entryOn(TODAY, { steps: 9904 })], [], 'week', TODAY, NOW, 12000)

describe('StepsChart', () => {
  it('shows its empty state for an empty series, without throwing', () => {
    render(<StepsChart days={empty.days} tab="week" stepGoal={12000} />)
    expect(screen.getByText('Log your steps to see them per day.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('names the trend, the total and the goal in its label', () => {
    render(<StepsChart days={full.days} tab="week" stepGoal={12000} />)
    expect(
      screen.getByRole('img', {
        name: 'Steps per day, rising: 9,120, 11,400. Total 20,520. Goal 12,000 a day.',
      }),
    ).toBeInTheDocument()
  })

  it('shows the total beside the title', () => {
    render(<StepsChart days={full.days} tab="week" stepGoal={12000} />)
    expect(screen.getByText('20,520 total')).toBeVisible()
  })

  it('draws the goal line from the step goal it is given', () => {
    const { container } = render(<StepsChart days={full.days} tab="week" stepGoal={8000} />)
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 8k'])
  })

  it('keeps the goal line for one logged day, beside one labelled bar', () => {
    const { container } = render(<StepsChart days={one.days} tab="week" stepGoal={12000} />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['9.9k'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 12k'])
  })
})

describe('stepsLabel', () => {
  it('says steady when the first and last day match', () => {
    expect(stepsLabel([5, 9, 5], 12000, 'week')).toBe(
      'Steps per day, steady: 5, 9, 5. Total 19. Goal 12,000 a day.',
    )
  })

  it('names the highest day on the month, where only that bar carries a value', () => {
    expect(stepsLabel([5, 9], 10, 'month')).toBe(
      'Steps per day this month, rising: 5, 9. Total 14. Highest 9. Goal 10 a day.',
    )
  })
})
