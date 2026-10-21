import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { combinePlans, stepGroups } from '../../lib/plans'
import { COACH_PLANS } from '../../lib/plans/coach'

import {
  STEP_LIST_CLOSE,
  STEP_MARK,
  StepListSheet,
  StepMark,
  stepRowLabel,
  stepListSummary,
  stepSections,
} from './StepListSheet'

import type { StepStatus } from '../../lib/metrics/planProgress'

const PLAN = combinePlans(['chest-triceps'])
const GROUPS = stepGroups(['chest-triceps'])
const STATUSES: StepStatus[] = [
  'done',
  'now',
  'skipped',
  ...PLAN.steps.slice(3).map((): StepStatus => 'todo'),
]

const SUMMARY_LINE = `1 done · 1 skipped · ${String(PLAN.steps.length - 2)} to go`

function setup(open = true) {
  const onPick = vi.fn()
  const onClose = vi.fn()
  render(
    <StepListSheet
      open={open}
      title="Chest + Triceps"
      steps={PLAN.steps}
      groups={GROUPS}
      statuses={STATUSES}
      onPick={onPick}
      onClose={onClose}
    />,
  )
  return { onPick, onClose }
}

describe('StepMark', () => {
  it('shows the glyph and the word of its status in the muted token', () => {
    render(<StepMark status="skipped" />)

    expect(screen.getByText('Skipped')).toHaveClass('text-muted')
    expect(screen.getByText('–')).toHaveClass('border-dashed')
  })

  it('draws the glyph in the system font, as the plates do, not the Arial fallback', () => {
    render(<StepMark status="todo" />)

    expect(screen.getByText('○')).toHaveClass('font-glyph', 'size-5', 'text-[11px]')
  })

  it('takes a label in place of the word, in the text token when asked', () => {
    render(<StepMark status="done" label="3 × 14 kg" tone="text" />)

    const mark = screen.getByText('3 × 14 kg')
    expect(mark).toHaveClass('text-text')
    expect(mark).not.toHaveTextContent('Done')
  })
})

describe('stepListSummary', () => {
  it('counts done, skipped and the steps still to go', () => {
    expect(stepListSummary(STATUSES)).toBe(SUMMARY_LINE)
  })
})

describe('stepRowLabel', () => {
  it('reads the number, the name, the target and the status word', () => {
    const step = PLAN.steps[0]
    if (step === undefined) throw new Error('no step')

    expect(stepRowLabel(0, step, 'done')).toBe('1. Incline Dumbbell Press, 3 × 10–12, Done')
  })
})

describe('stepSections', () => {
  it('keeps the coach order under each group', () => {
    const sections = stepSections(PLAN.steps, GROUPS)

    const coach = COACH_PLANS.find((plan) => plan.id === 'chest-triceps')?.groups ?? []

    expect(sections.map((section) => [section.name, section.items.length])).toEqual(
      coach.map((group) => [group.name, group.steps.length]),
    )
    expect(sections[1]?.items[0]?.index).toBe(coach[0]?.steps.length)
  })

  it('puts a step with no group under an empty name', () => {
    const step = COACH_PLANS[0]?.groups[0]?.steps[0]
    if (step === undefined) throw new Error('no step')

    expect(stepSections([step], new Map())).toEqual([{ name: '', items: [{ step, index: 0 }] }])
  })
})

describe('StepListSheet', () => {
  it('renders nothing when closed', () => {
    setup(false)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lists every step of the session as a button under its group', () => {
    setup()

    const dialog = screen.getByRole('dialog', { name: 'Chest + Triceps' })
    expect(within(dialog).getByText(SUMMARY_LINE)).toBeInTheDocument()
    const chest = within(dialog).getByRole('region', { name: 'Chest' })
    const triceps = within(dialog).getByRole('region', { name: 'Triceps' })
    const coach = COACH_PLANS.find((plan) => plan.id === 'chest-triceps')?.groups ?? []
    expect(within(chest).getAllByRole('button')).toHaveLength(coach[0]?.steps.length ?? 0)
    expect(within(triceps).getAllByRole('button')).toHaveLength(coach[1]?.steps.length ?? 0)
  })

  it('marks each status with a shape and a word', () => {
    setup()

    const rows = within(screen.getByRole('dialog')).getAllByRole('button', { name: /^\d/ })
    expect(rows[0]).toHaveTextContent(`${STEP_MARK.done.glyph}${STEP_MARK.done.word}`)
    expect(rows[1]).toHaveTextContent('●Now')
    expect(rows[2]).toHaveTextContent('–Skipped')
    expect(rows[3]).toHaveTextContent('○Not started')
    expect(rows[3]).toHaveTextContent('3 × 10–12')
  })

  it('marks the current step with aria-current and the accent edge', () => {
    setup()

    const now = within(screen.getByRole('dialog')).getByRole('button', { current: 'step' })
    expect(now).toHaveTextContent(PLAN.steps[1]?.name ?? '')
    expect(now).toHaveClass('border-accent', 'min-h-[52px]')
  })

  it('picks a step on a tap', async () => {
    const { onPick } = setup()

    await userEvent.click(
      screen.getByRole('button', { name: '5. Dumbbell Pullover, 3 × 10–12, Not started' }),
    )
    expect(onPick).toHaveBeenCalledWith(4)
  })

  it('puts focus on the close button, named for the step list', async () => {
    const { onClose } = setup()

    const close = screen.getByRole('button', { name: STEP_LIST_CLOSE })
    expect(close).toHaveFocus()
    await userEvent.click(close)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
