import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DangerButton } from './DangerButton'

describe('DangerButton', () => {
  it('is a button of type button by default', () => {
    render(<DangerButton>Delete session</DangerButton>)
    expect(screen.getByRole('button', { name: 'Delete session' })).toHaveAttribute('type', 'button')
  })

  it('tints the fill, the text and the border with the danger token', () => {
    render(<DangerButton>Delete session</DangerButton>)
    expect(screen.getByRole('button')).toHaveClass(
      'bg-danger/15',
      'text-danger',
      'border-danger/40',
      'min-h-[54px]',
    )
  })

  it('appends a class and calls its click handler', async () => {
    const onClick = vi.fn()
    render(
      <DangerButton className="max-w-sm" onClick={onClick}>
        Delete session
      </DangerButton>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button')).toHaveClass('max-w-sm')
  })
})
