import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getPlan } from '../../lib/plans'

import { SuggestedPlanHero } from './SuggestedPlanHero'

import type { Plan, PlanId } from '../../lib/schema/plan'

function plan(id: PlanId): Plan {
  const found = getPlan(id)
  if (found === undefined) throw new Error(`expected the plan ${id}`)
  return found
}

describe('SuggestedPlanHero', () => {
  it('names the suggested plan in a labelled region', () => {
    render(<SuggestedPlanHero plan={plan('legs')} lastDone={undefined} today="2026-10-20" />)
    const hero = screen.getByRole('region', { name: "Today's suggestion" })

    expect(hero).toHaveTextContent('Legs')
  })

  it('gives the least recent reason with the days', () => {
    render(
      <SuggestedPlanHero plan={plan('chest-triceps')} lastDone="2026-10-14" today="2026-10-20" />,
    )

    expect(screen.getByText('You did it least recently: 6 days ago')).toBeInTheDocument()
  })

  it('says a plan never done is not done yet', () => {
    render(<SuggestedPlanHero plan={plan('legs')} lastDone={undefined} today="2026-10-20" />)

    expect(screen.getByText('You have not done it yet')).toBeInTheDocument()
  })

  it('links to the preview with the step count', () => {
    render(
      <SuggestedPlanHero plan={plan('chest-triceps')} lastDone="2026-10-14" today="2026-10-20" />,
    )
    const link = screen.getByRole('link', { name: 'See the 9 steps →' })

    expect(link).toHaveAttribute('href', '/workouts/chest-triceps')
    expect(link).toHaveClass('min-h-11')
  })
})
