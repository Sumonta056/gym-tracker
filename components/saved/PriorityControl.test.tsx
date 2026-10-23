import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PriorityControl } from './PriorityControl'

import type { Priority } from '../../lib/schema/savedVideo'

function Harness({ onChange }: { onChange?: (priority: Priority) => void }) {
  const [value, setValue] = useState<Priority>('normal')

  return (
    <PriorityControl
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

describe('PriorityControl', () => {
  it('is a radio group named "Priority" with High, Normal and Low', () => {
    render(<Harness />)

    const group = screen.getByRole('radiogroup', { name: 'Priority' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'high',
      'normal',
      'low',
    ])
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked()
  })

  it('makes each choice 44 px tall', () => {
    render(<Harness />)

    for (const name of ['High', 'Normal', 'Low']) {
      expect(screen.getByRole('radio', { name }).closest('label')).toHaveClass('min-h-11')
    }
  })

  it('picks a choice on tap', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await userEvent.click(screen.getByText('High'))

    expect(onChange).toHaveBeenCalledWith('high')
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked()
  })

  it('moves the choice with the arrow keys', async () => {
    render(<Harness />)
    screen.getByRole('radio', { name: 'Normal' }).focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked()

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked()
  })
})
