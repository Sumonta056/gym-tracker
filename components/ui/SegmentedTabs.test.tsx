import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SegmentedTabs } from './SegmentedTabs'

const OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

function setup(value = 'day') {
  const onValueChange = vi.fn()
  render(
    <SegmentedTabs label="Range" options={OPTIONS} value={value} onValueChange={onValueChange} />,
  )
  return { onValueChange }
}

describe('SegmentedTabs', () => {
  it('renders one real button per option', () => {
    setup()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('names the group for a screen reader', () => {
    setup()
    expect(screen.getByRole('group', { name: 'Range' })).toBeInTheDocument()
  })

  it('marks the selected option as pressed', () => {
    setup('week')
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('fills the selected option with the accent pill', () => {
    setup('week')
    const selected = screen.getByRole('button', { name: 'Week' })
    expect(selected).toHaveClass('bg-accent')
    expect(selected).toHaveClass('text-accent-ink')
  })

  it('reports the option the user picks', async () => {
    const { onValueChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Month' }))
    expect(onValueChange).toHaveBeenCalledWith('month')
  })

  it('keeps every tab at least 44 px tall', () => {
    setup()
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('h-11')
    }
  })
})
