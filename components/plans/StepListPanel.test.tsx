import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { combinePlans, stepGroups } from '../../lib/plans'

import { StepListPanel } from './StepListPanel'

import type { StepStatus } from '../../lib/metrics/planProgress'

const PLAN = combinePlans(['chest-triceps'])
const GROUPS = stepGroups(['chest-triceps'])
const STATUSES: StepStatus[] = [
  'done',
  'now',
  'skipped',
  'todo',
  'todo',
  'todo',
  'todo',
  'todo',
  'todo',
]

function setup(busy = false, statuses: readonly StepStatus[] = STATUSES) {
  const onPick = vi.fn()
  render(
    <StepListPanel
      steps={PLAN.steps}
      groups={GROUPS}
      statuses={statuses}
      busy={busy}
      onPick={onPick}
      className="hidden lg:grid"
    />,
  )
  return { onPick, panel: screen.getByRole('region', { name: 'Steps' }) }
}

describe('StepListPanel', () => {
  it('heads the list Steps with the done, skipped and to go counts', () => {
    const { panel } = setup()

    expect(within(panel).getByText('1 done · 1 skipped · 7 to go')).toBeInTheDocument()
  })

  it('lists every step under its group as a button with a thumbnail, the target and a mark', () => {
    const { panel } = setup()

    const chest = within(panel).getByRole('region', { name: 'Chest' })
    const rows = within(chest).getAllByRole('button')
    expect(rows[0]).toHaveAccessibleName(`1. ${PLAN.steps[0]?.name ?? ''}, 3 × 10–12, Done`)
    expect(rows[0]?.querySelector('img')).toHaveAttribute('alt', '')
    expect(rows[2]).toHaveTextContent('Skipped')
    expect(within(panel).getByRole('region', { name: 'Triceps' })).toBeInTheDocument()
    expect(within(panel).getAllByRole('button')).toHaveLength(PLAN.steps.length)
  })

  it('marks the current row with aria-current and the accent edge', () => {
    const { panel } = setup()

    const now = within(panel).getByRole('button', { current: 'step' })
    expect(now).toHaveAccessibleName(`2. ${PLAN.steps[1]?.name ?? ''}, 3 × 10–12, Now`)
    expect(now).toHaveClass('border-accent', 'min-h-[58px]')
    expect(within(panel).getAllByRole('button')[0]).toHaveClass('border-border')
  })

  it('moves the cursor to a clicked row', async () => {
    const { onPick, panel } = setup()

    await userEvent.click(within(panel).getByRole('button', { name: /^5\. / }))
    expect(onPick).toHaveBeenCalledWith(4)
  })

  it('takes no click while a write runs', () => {
    const { panel } = setup(true)

    for (const row of within(panel).getAllByRole('button')) expect(row).toBeDisabled()
  })

  it('reads a step with no status as not started', () => {
    const { panel } = setup(false, [])

    expect(within(panel).getAllByRole('button')[0]).toHaveTextContent('Not started')
  })

  it('shows only from 1024 px up', () => {
    const { panel } = setup()

    expect(panel.parentElement).toHaveClass('hidden', 'lg:grid')
  })
})
