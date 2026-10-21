import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { muscleLabel } from '../../components/plans/MuscleMap'
import { combinePlans } from '../../lib/plans'
import { COACH_PLANS } from '../../lib/plans/coach'

import {
  CoachPlanSample,
  GuidedStepSample,
  MuscleMapSample,
  PlanDoneSample,
  SetRowsSample,
} from './PlanSamples'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/styleguide',
}))

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

const GUIDED = combinePlans(['chest-triceps'])

function guidedName(index: number): string {
  return GUIDED.steps[index]?.name ?? ''
}

describe('MuscleMapSample', () => {
  beforeEach(() => {
    render(<MuscleMapSample />)
  })

  it('offers every coach step in the muscle map sample', () => {
    const sample = within(screen.getByTestId('muscle-map-sample'))
    const steps = COACH_PLANS.flatMap((plan) => plan.groups.flatMap((group) => group.steps))
    expect(
      within(sample.getByRole('combobox', { name: 'Coach step' })).getAllByRole('option'),
    ).toHaveLength(steps.length)
  })

  it('drops the native select style so the coach step keeps its 44 px height in WebKit', () => {
    const sample = within(screen.getByTestId('muscle-map-sample'))
    const select = sample.getByRole('combobox', { name: 'Coach step' })
    expect(select).toHaveClass('appearance-none', 'min-h-11', 'pr-10')
    expect(select.parentElement?.querySelector('svg[data-icon="chevron"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('shows the frame, the card and the chip map for the chosen step', () => {
    const sample = within(screen.getByTestId('muscle-map-sample'))
    const [first] = COACH_PLANS.flatMap((plan) => plan.groups.flatMap((group) => group.steps))
    const label = muscleLabel(first?.muscles.primary ?? [], first?.muscles.secondary ?? [])
    expect(sample.getAllByRole('img', { name: label })).toHaveLength(3)
    expect(sample.getByRole('list', { name: 'Muscles' })).toBeInTheDocument()
  })

  it('redraws the muscle map sample for every step it is given', async () => {
    const sample = within(screen.getByTestId('muscle-map-sample'))
    const select = sample.getByRole('combobox', { name: 'Coach step' })
    const steps = COACH_PLANS.flatMap((plan) => plan.groups.flatMap((group) => group.steps))
    for (const step of steps) {
      await userEvent.selectOptions(select, step.slug)
      const label = muscleLabel(step.muscles.primary, step.muscles.secondary)
      expect(sample.getAllByRole('img', { name: label })).toHaveLength(3)
      expect(sample.getAllByText(step.name).length).toBeGreaterThan(0)
    }
  })
})

describe('CoachPlanSample', () => {
  beforeEach(() => {
    render(<CoachPlanSample />)
  })

  it('shows the coach plan hero, cards, start bars, watch pill and step list', async () => {
    const sample = within(screen.getByTestId('coach-plan-sample'))
    expect(sample.getByRole('region', { name: "Today's suggestion" })).toHaveTextContent('Legs')
    const legs = sample.getByRole('button', { name: /^Legs/ })
    expect(legs).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(legs)
    expect(legs).toHaveAttribute('aria-pressed', 'false')
    expect(sample.getByRole('button', { name: 'Pick a plan to start' })).toBeDisabled()
    expect(sample.getByRole('button', { name: /^Start Shoulders \+ Legs/ })).toHaveTextContent(
      'combined',
    )
    expect(
      sample.getByRole('link', {
        name: 'Tutorial on YouTube: Incline Dumbbell Press, opens a new tab',
      }),
    ).toBeInTheDocument()
    expect(sample.getByRole('region', { name: 'Biceps' })).toBeInTheDocument()
  })
})

describe('GuidedStepSample', () => {
  beforeEach(() => {
    render(<GuidedStepSample />)
  })

  it('shows the step frame in its 2 views, How to and Muscles', () => {
    const frames = [...screen.getByTestId('guided-step-sample').querySelectorAll('figure')]

    expect(frames.map((frame) => frame.dataset.view)).toEqual(['howto', 'muscles'])
  })

  it('shows the step progress with every status', () => {
    const bars = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')

    expect(bars).toHaveLength(GUIDED.steps.length)
    expect(new Set(bars.map((bar) => bar.dataset.state))).toEqual(
      new Set(['done', 'now', 'skipped', 'todo']),
    )
  })

  it('shows every step mark and the not done word, each glyph in the system font', () => {
    const marks = within(screen.getByRole('list', { name: 'Step marks' })).getAllByRole('listitem')

    expect(marks.map((mark) => mark.textContent)).toEqual([
      '✓Done',
      '●Now',
      '–Skipped',
      '○Not started',
      '○Not done',
    ])
    for (const mark of marks) {
      expect(mark.querySelector('[aria-hidden="true"]')).toHaveClass('font-glyph')
    }
  })

  it('moves the current step from the step list panel', async () => {
    const panel = screen.getByRole('region', { name: 'Steps' })
    await userEvent.click(
      within(panel).getByRole('button', { name: new RegExp(`^5\. ${guidedName(4)}`) }),
    )

    expect(within(panel).getByRole('button', { current: 'step' })).toHaveAccessibleName(
      new RegExp(`^5\. ${guidedName(4)}, .+, Now$`),
    )
  })

  it('opens the step list sheet and moves to a tapped step', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the step list sheet' }))
    const sheet = screen.getByRole('dialog', { name: GUIDED.title })
    await userEvent.click(
      within(sheet).getByRole('button', { name: new RegExp(`^4\. ${guidedName(3)}`) }),
    )

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      within(screen.getByRole('region', { name: 'Steps' })).getByRole('button', {
        current: 'step',
      }),
    ).toHaveAccessibleName(new RegExp(`^4\. ${guidedName(3)}`))
  })

  it('closes the step list sheet on its close button', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the step list sheet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close the step list' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the finish confirm sheet with every step not done, and closes it both ways', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the finish confirm sheet' }))
    const confirm = screen.getByRole('dialog', { name: 'Finish the session?' })

    expect(
      within(within(confirm).getByRole('list', { name: 'Steps not done' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(GUIDED.steps.length - 1)
    await userEvent.click(within(confirm).getByRole('button', { name: 'Keep going' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Open the finish confirm sheet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish anyway' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('SetRowsSample', () => {
  beforeEach(() => {
    render(<SetRowsSample />)
  })

  it('shows the native weight list on the open set row', async () => {
    const select = screen.getByRole('combobox', { name: 'Set 2 weight' })

    expect(select.tagName).toBe('SELECT')
    await userEvent.selectOptions(select, '22.5')
    expect(screen.getByRole('combobox', { name: 'Set 2 weight' })).toHaveValue('22.5')
  })

  it('adds a set row from the compact Add set button', async () => {
    const add = screen.getByRole('button', { name: `Add set to ${guidedName(1)}` })

    expect(add).toHaveClass('min-h-11', 'text-sm')
    await userEvent.click(add)
    expect(screen.getByRole('combobox', { name: 'Set 3 weight' })).toBeInTheDocument()
  })

  it('shows the narrow rest card that folds to 1 row from 1280 px', () => {
    const rest = screen.getByRole('region', { name: 'Rest timer' })

    expect(within(rest).getByRole('timer', { name: 'Rest remaining' })).toHaveTextContent('0:48')
    expect(within(rest).getByRole('button', { name: 'Skip rest' }).parentElement).toHaveClass(
      'xl:flex-nowrap',
    )
  })

  it('shows the secondary button at its default and its compact size', () => {
    expect(screen.getByRole('button', { name: 'Secondary button' })).toHaveClass('min-h-[54px]')
    expect(screen.getByRole('button', { name: 'Secondary button, compact' })).toHaveClass(
      'min-h-11',
      'text-sm',
    )
  })
})

describe('PlanDoneSample', () => {
  it('shows the plan Done screen with every step and its mark', () => {
    render(<PlanDoneSample />)

    expect(screen.getByRole('heading', { level: 1, name: 'Session done' })).toBeInTheDocument()
    const rows = within(screen.getByRole('region', { name: 'Steps' })).getAllByRole('listitem')
    expect(rows).toHaveLength(GUIDED.steps.length)
    expect(rows.map((row) => row.dataset.outcome)).toContain('skipped')
    expect(rows.at(-1)).toHaveTextContent(`${guidedName(GUIDED.steps.length - 1)}○Not done`)
    expect(screen.getByTestId('done-foot')).toHaveTextContent(
      `of ${String(GUIDED.steps.length)} steps`,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'New records' })).toBeInTheDocument()
  })
})
