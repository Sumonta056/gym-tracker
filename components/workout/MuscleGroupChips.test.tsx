import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MUSCLE_GROUPS } from '../../lib/schema/exercise'

import { ALL_LABEL, MUSCLE_GROUP_LABEL, MuscleGroupChips } from './MuscleGroupChips'

describe('MuscleGroupChips', () => {
  it('is a toggle group with one button per muscle group and All first', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )
    const buttons = within(screen.getByRole('group', { name: 'Muscle group' })).getAllByRole(
      'button',
    )
    expect(buttons.map((button) => button.textContent)).toEqual([
      ALL_LABEL,
      ...MUSCLE_GROUPS.map((group) => MUSCLE_GROUP_LABEL[group]),
    ])
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  it('marks the chosen chip with aria-pressed', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value="back" onValueChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports null for All and the group for a chip', async () => {
    const onValueChange = vi.fn()
    render(
      <MuscleGroupChips
        includeAll
        label="Muscle group"
        value="back"
        onValueChange={onValueChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Arms' }))
    await userEvent.click(screen.getByRole('button', { name: 'All' }))

    expect(onValueChange.mock.calls).toEqual([['arms'], [null]])
  })

  it('leaves out All when asked', () => {
    render(
      <MuscleGroupChips
        includeAll={false}
        label="Muscle group"
        value={null}
        onValueChange={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(MUSCLE_GROUPS.length)
  })

  it('keeps every chip at least 44 px tall', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )
    screen.getAllByRole('button').forEach((button) => {
      expect(button.className).toContain('min-h-11')
    })
  })

  it('ties every chip to the error it is given', () => {
    render(
      <>
        <p id="chip-error">Pick a muscle group.</p>
        <MuscleGroupChips
          includeAll={false}
          label="Muscle group"
          value={null}
          describedBy="chip-error"
          onValueChange={vi.fn()}
        />
      </>,
    )
    screen.getAllByRole('button').forEach((button) => {
      expect(button).toHaveAccessibleDescription('Pick a muscle group.')
    })
  })
})
