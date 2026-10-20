import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BACK_LABEL, LEAVE_LABEL, PlanStepHeader, stepCountText } from './PlanStepHeader'

const STARTED = '2026-10-20T09:00:00.000Z'

function setup(stepIndex: number, onBack = vi.fn()) {
  render(
    <PlanStepHeader
      title="Chest + Triceps"
      stepIndex={stepIndex}
      total={9}
      group="Chest"
      startedAt={STARTED}
      leaveHref="/workouts"
      now={() => new Date('2026-10-20T09:12:41.000Z')}
      onBack={onBack}
    />,
  )
  return onBack
}

describe('stepCountText', () => {
  it('counts from 1 and names the group', () => {
    expect(stepCountText(1, 9, 'Chest')).toBe('Step 2 of 9 · Chest')
  })
})

describe('PlanStepHeader', () => {
  it('shows a leave link to Workouts on step 1, and no back button', () => {
    setup(0)

    expect(screen.getByRole('link', { name: LEAVE_LABEL })).toHaveAttribute('href', '/workouts')
    expect(screen.queryByRole('button', { name: BACK_LABEL })).toBeNull()
  })

  it('shows a back button on step 2 that calls back', async () => {
    const onBack = setup(1)

    expect(screen.queryByRole('link', { name: LEAVE_LABEL })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: BACK_LABEL }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows the plan title and the step count with the group', () => {
    setup(1)

    expect(screen.getByText('Chest + Triceps')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 9 · Chest')).toBeInTheDocument()
  })

  it('shows the time since the session started, labelled Elapsed', () => {
    setup(1)

    expect(screen.getByRole('timer', { name: 'Elapsed' })).toHaveTextContent('12:41')
  })

  it('keeps the corner control 44 px square', () => {
    setup(1)

    expect(screen.getByRole('button', { name: BACK_LABEL })).toHaveClass('size-11')
  })
})
