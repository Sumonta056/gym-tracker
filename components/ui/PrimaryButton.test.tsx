import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PrimaryButton } from './PrimaryButton'

describe('PrimaryButton', () => {
  it('renders a real button with its label', () => {
    render(<PrimaryButton>Log a set</PrimaryButton>)
    expect(screen.getByRole('button', { name: 'Log a set' })).toBeInTheDocument()
  })

  it('defaults to a non submitting button', () => {
    render(<PrimaryButton>Log a set</PrimaryButton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('accepts a submit type', () => {
    render(<PrimaryButton type="submit">Save</PrimaryButton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('grows with a wrapped label instead of clipping it', () => {
    render(<PrimaryButton>Log a set</PrimaryButton>)
    expect(screen.getByRole('button')).not.toHaveClass('h-[54px]')
  })

  it('sets its label at the recipe size: 15 px, bold, tight tracking, 16 px sides', () => {
    render(<PrimaryButton>Log a set</PrimaryButton>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-[15px]', 'font-bold', 'tracking-[-0.2px]', 'px-4', 'gap-2')
    expect(button).toHaveClass('border', 'border-accent')
    expect(button).not.toHaveClass('font-extrabold')
  })

  it('is at least 54 px tall with the accent fill and accent ink text', () => {
    render(<PrimaryButton>Log a set</PrimaryButton>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('min-h-[54px]')
    expect(button).toHaveClass('bg-accent')
    expect(button).toHaveClass('text-accent-ink')
  })

  it('calls its click handler', async () => {
    const onClick = vi.fn()
    render(<PrimaryButton onClick={onClick}>Log a set</PrimaryButton>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call its handler when disabled', async () => {
    const onClick = vi.fn()
    render(
      <PrimaryButton onClick={onClick} disabled>
        Log a set
      </PrimaryButton>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
