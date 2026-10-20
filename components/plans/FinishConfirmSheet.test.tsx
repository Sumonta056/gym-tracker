import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  FINISH_ANYWAY,
  FINISH_TITLE,
  FinishConfirmSheet,
  KEEP_GOING,
  keptText,
  notDoneText,
} from './FinishConfirmSheet'

import type { NotDoneStep } from './FinishConfirmSheet'

const NOT_DONE: NotDoneStep[] = [
  { index: 2, name: 'Incline Dumbbell Fly', status: 'skipped' },
  { index: 6, name: 'Rope Pushdown', status: 'now' },
  { index: 7, name: 'Straight Bar Pushdown', status: 'todo' },
]

function setup(busy = false) {
  const onFinish = vi.fn()
  const onClose = vi.fn()
  render(
    <FinishConfirmSheet
      open
      notDone={NOT_DONE}
      setCount={15}
      busy={busy}
      onFinish={onFinish}
      onClose={onClose}
    />,
  )
  return { onFinish, onClose }
}

describe('notDoneText', () => {
  it('counts the steps not done', () => {
    expect(notDoneText(4)).toBe('4 steps not done.')
    expect(notDoneText(1)).toBe('1 step not done.')
  })
})

describe('keptText', () => {
  it('says the ticked sets are kept', () => {
    expect(keptText(15)).toBe('The 15 sets you ticked are kept.')
    expect(keptText(1)).toBe('The 1 set you ticked is kept.')
  })

  it('says no set is ticked yet', () => {
    expect(keptText(0)).toBe('No set is ticked yet.')
  })
})

describe('FinishConfirmSheet', () => {
  it('names how many steps are not done and lists each with its mark', () => {
    setup()

    const dialog = screen.getByRole('dialog', { name: FINISH_TITLE })
    expect(dialog).toHaveAccessibleDescription(
      '3 steps not done. The summary lists them as not done. The 15 sets you ticked are kept.',
    )
    const rows = within(screen.getByRole('list', { name: 'Steps not done' })).getAllByRole(
      'listitem',
    )
    expect(rows.map((row) => row.textContent)).toEqual([
      '3 · Incline Dumbbell Fly– Skipped',
      '7 · Rope Pushdown○ Not started',
      '8 · Straight Bar Pushdown○ Not started',
    ])
  })

  it('starts focus on Keep going', () => {
    setup()

    expect(screen.getByRole('button', { name: KEEP_GOING })).toHaveFocus()
  })

  it('finishes on Finish anyway and closes on Keep going', async () => {
    const { onFinish, onClose } = setup()

    await userEvent.click(screen.getByRole('button', { name: FINISH_ANYWAY }))
    expect(onFinish).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: KEEP_GOING }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('disables Finish anyway while a write runs', () => {
    setup(true)

    expect(screen.getByRole('button', { name: FINISH_ANYWAY })).toBeDisabled()
  })
})
