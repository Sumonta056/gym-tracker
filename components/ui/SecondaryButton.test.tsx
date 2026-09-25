import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SecondaryButton } from './SecondaryButton'

describe('SecondaryButton', () => {
  it('renders a real button with its label', () => {
    render(<SecondaryButton>Cancel</SecondaryButton>)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('is at least 54 px tall with the second surface and a border', () => {
    render(<SecondaryButton>Cancel</SecondaryButton>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('min-h-[54px]')
    expect(button).toHaveClass('bg-surface-2')
    expect(button).toHaveClass('border-border')
  })

  it('grows with a wrapped label instead of clipping it', () => {
    render(<SecondaryButton>Cancel</SecondaryButton>)
    expect(screen.getByRole('button')).not.toHaveClass('h-[54px]')
  })

  it('sets its label at the recipe size: 15 px, bold, tight tracking, 16 px sides', () => {
    render(<SecondaryButton>Cancel</SecondaryButton>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-[15px]', 'font-bold', 'tracking-[-0.2px]', 'px-4', 'gap-2')
    expect(button).not.toHaveClass('text-base')
    expect(button).not.toHaveClass('px-5')
  })

  it('writes its label in the text token by default', () => {
    render(<SecondaryButton>Cancel</SecondaryButton>)
    expect(screen.getByRole('button')).toHaveClass('text-text')
  })

  it('writes a destructive label in the danger token', () => {
    render(<SecondaryButton tone="danger">Sign out</SecondaryButton>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-danger')
    expect(button).not.toHaveClass('text-text')
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
