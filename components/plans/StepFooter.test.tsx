import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { StepFooter } from './StepFooter'

function setup(nextName: string | undefined, busy = false) {
  const handlers = { onSkip: vi.fn(), onNext: vi.fn(), onFinish: vi.fn() }
  render(<StepFooter nextName={nextName} busy={busy} {...handlers} />)
  return handlers
}

describe('StepFooter', () => {
  it('names the next step under Next step', () => {
    setup('Incline Dumbbell Fly')

    expect(screen.getByRole('button', { name: /^Next step ?Incline Dumbbell Fly$/ })).toBeVisible()
  })

  it('calls next and skip', async () => {
    const handlers = setup('Incline Dumbbell Fly')

    await userEvent.click(screen.getByRole('button', { name: /^Next step/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(handlers.onNext).toHaveBeenCalledOnce()
    expect(handlers.onSkip).toHaveBeenCalledOnce()
  })

  it('reads Finish session on the last step', async () => {
    const handlers = setup(undefined)

    expect(screen.queryByRole('button', { name: /^Next step/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }))
    expect(handlers.onFinish).toHaveBeenCalledOnce()
  })

  it('makes both buttons 54 px tall', () => {
    setup('Rope Pushdown')

    expect(screen.getByRole('button', { name: 'Skip' })).toHaveClass('min-h-[54px]')
    expect(screen.getByRole('button', { name: /^Next step/ })).toHaveClass('min-h-[54px]')
  })

  it('disables both buttons while a write runs', () => {
    setup('Rope Pushdown', true)

    expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Next step/ })).toBeDisabled()
  })

  it('pins the bar to the foot under 1024 px and puts it in the page flow above', () => {
    setup('Rope Pushdown')

    expect(screen.getByTestId('step-footer')).toHaveClass('fixed', 'bottom-0', 'lg:static')
  })
})
