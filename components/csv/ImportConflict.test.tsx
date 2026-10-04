import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CHOICE_HINT, CONFLICT_QUESTION, ImportConflict } from './ImportConflict'

import type { ImportChoice } from '../../lib/db/repository'

function setup(choice: ImportChoice | null = null) {
  const onChoose = vi.fn()
  render(<ImportConflict label="Row 16, 13 September" choice={choice} onChoose={onChoose} />)
  return {
    onChoose,
    group: within(screen.getByRole('group', { name: 'Row 16, 13 September, already logged' })),
  }
}

describe('ImportConflict', () => {
  it('asks what the import should do with a date already logged', () => {
    setup()
    expect(screen.getByText(CONFLICT_QUESTION)).toBeInTheDocument()
  })

  it('offers Skip, Overwrite and Merge as real buttons in a labelled group', () => {
    const { group } = setup()
    const buttons = group.getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['Skip', 'Overwrite', 'Merge'])
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button')
    }
  })

  it('starts with no choice pressed and asks for one', () => {
    const { group } = setup()
    for (const button of group.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByText(CHOICE_HINT.none)).toBeInTheDocument()
  })

  it('marks the chosen option as pressed and says what it does', () => {
    const { group } = setup('merge')
    expect(group.getByRole('button', { name: 'Merge' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Merge fills only the empty fields of that day.')).toBeInTheDocument()
  })

  it('says that Overwrite clears a field the sheet leaves blank', () => {
    setup('overwrite')
    expect(screen.getByText(CHOICE_HINT.overwrite)).toBeInTheDocument()
  })

  it('reports the option the user picks', async () => {
    const { group, onChoose } = setup()
    await userEvent.click(group.getByRole('button', { name: 'Skip' }))
    expect(onChoose).toHaveBeenCalledWith('skip')
  })
})
