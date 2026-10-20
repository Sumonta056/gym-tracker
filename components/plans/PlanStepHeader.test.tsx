import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  BACK_LABEL,
  FINISH_LABEL,
  LEAVE_LABEL,
  PlanStepHeader,
  stepCountText,
  stepJumpLabel,
} from './PlanStepHeader'

const STARTED = '2026-10-20T09:00:00.000Z'

const JUMP = 'Step 2 of 9, elapsed 12 minutes 41 seconds, open the step list'

function setup(stepIndex: number, busy = false) {
  const handlers = { onBack: vi.fn(), onOpenList: vi.fn(), onFinish: vi.fn() }

  render(
    <PlanStepHeader
      title="Chest + Triceps"
      stepIndex={stepIndex}
      total={9}
      startedAt={STARTED}
      leaveHref="/workouts"
      now={() => new Date('2026-10-20T09:12:41.000Z')}
      busy={busy}
      {...handlers}
    />,
  )
  return handlers
}

describe('stepCountText', () => {
  it('counts from 1', () => {
    expect(stepCountText(1, 9)).toBe('Step 2 of 9')
  })
})

describe('stepJumpLabel', () => {
  it('says the step, the elapsed time in words and what the button opens', () => {
    expect(stepJumpLabel(1, 9, 761)).toBe(JUMP)
  })
})

describe('PlanStepHeader', () => {
  it('shows a leave link to Workouts on step 1, and no back button', () => {
    setup(0)

    expect(screen.getByRole('link', { name: LEAVE_LABEL })).toHaveAttribute('href', '/workouts')
    expect(screen.queryByRole('button', { name: BACK_LABEL })).toBeNull()
  })

  it('shows a back button on step 2 that calls back', async () => {
    const { onBack } = setup(1)

    expect(screen.queryByRole('link', { name: LEAVE_LABEL })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: BACK_LABEL }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows the plan title over 1 button with the step count and the elapsed time', () => {
    setup(1)

    expect(screen.getByText('Chest + Triceps')).toBeInTheDocument()
    const jump = screen.getByRole('button', { name: JUMP })
    expect(jump).toHaveTextContent(/^Step 2 of 9 ·\s?12:41 ▾$/)
    expect(jump).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.getByTestId('step-elapsed')).toHaveClass('text-accent')
    expect(screen.queryByText('Elapsed')).toBeNull()
  })

  it('hides the step button at 1024 px and up, and shows the count as plain text there', () => {
    setup(1)

    expect(screen.getByRole('button', { name: JUMP })).toHaveClass('lg:hidden')
    const wide = screen.getByTestId('step-count-wide')
    expect(wide.tagName).toBe('P')
    expect(wide).toHaveClass('hidden', 'lg:inline-flex')
    expect(wide).toHaveTextContent(/^Step 2 of 9 ·\s?12:41$/)
    expect(wide).not.toHaveTextContent('▾')
  })

  it('opens the step list from the step button', async () => {
    const { onOpenList } = setup(1)

    await userEvent.click(screen.getByRole('button', { name: JUMP }))
    expect(onOpenList).toHaveBeenCalledOnce()
  })

  it('shows Finish on step 1 and calls finish', async () => {
    const { onFinish } = setup(0)

    await userEvent.click(screen.getByRole('button', { name: FINISH_LABEL }))
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('disables back and Finish while a write runs', () => {
    setup(1, true)

    expect(screen.getByRole('button', { name: BACK_LABEL })).toBeDisabled()
    expect(screen.getByRole('button', { name: FINISH_LABEL })).toBeDisabled()
  })

  it('keeps every control 44 px tall', () => {
    setup(1)

    expect(screen.getByRole('button', { name: BACK_LABEL })).toHaveClass('size-11')
    expect(screen.getByRole('button', { name: JUMP })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: FINISH_LABEL })).toHaveClass('min-h-11')
  })
})
