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

  it('is 54 px tall with the accent fill and accent ink text', () => {
    render(<PrimaryButton>Log a set</PrimaryButton>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-[54px]')
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
