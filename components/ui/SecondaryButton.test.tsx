import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SecondaryButton } from './SecondaryButton'

describe('SecondaryButton', () => {
  it('renders a real button with its label', () => {
    render(<SecondaryButton>Cancel</SecondaryButton>)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('is 54 px tall with the second surface and a border', () => {
    render(<SecondaryButton>Cancel</SecondaryButton>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-[54px]')
    expect(button).toHaveClass('bg-surface-2')
    expect(button).toHaveClass('border-border')
  })

  it('defaults to a non submitting button', () => {
    render(<SecondaryButton>Cancel</SecondaryButton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('calls its click handler', async () => {
    const onClick = vi.fn()
    render(<SecondaryButton onClick={onClick}>Cancel</SecondaryButton>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
