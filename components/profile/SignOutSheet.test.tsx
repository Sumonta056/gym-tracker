import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SignOutSheet, writesWord } from './SignOutSheet'

describe('SignOutSheet', () => {
  it('is not in the document while nothing would be lost', () => {
    render(<SignOutSheet lost={null} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says how many writes sign out would lose', () => {
    render(<SignOutSheet lost={3} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Sign out with unsynced writes?' })).toBeVisible()
    expect(
      screen.getByText(
        '3 writes have not reached the server. Signing out deletes them from this device for good.',
      ),
    ).toBeInTheDocument()
  })

  it('confirms through a destructive button that names the loss', async () => {
    const onConfirm = vi.fn()
    render(<SignOutSheet lost={3} onConfirm={onConfirm} onCancel={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Sign out and lose 3 writes' })
    expect(button).toHaveClass('text-danger')
    await userEvent.click(button)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancels from its cancel button', async () => {
    const onCancel = vi.fn()
    render(<SignOutSheet lost={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    expect(
      screen.getByText(
        '1 write has not reached the server. Signing out deletes it from this device for good.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape', async () => {
    const onCancel = vi.fn()
    render(<SignOutSheet lost={2} onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('writesWord', () => {
  it('writes one write in the singular and more in the plural', () => {
    expect(writesWord(1)).toBe('1 write')
    expect(writesWord(4)).toBe('4 writes')
  })
})
