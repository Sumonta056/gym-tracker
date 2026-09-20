import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SheetModal } from './SheetModal'

function setup(open = true) {
  const onClose = vi.fn()
  render(
    <SheetModal open={open} title="Log a set" onClose={onClose}>
      <p>Sheet body</p>
    </SheetModal>,
  )
  return { onClose }
}

describe('SheetModal', () => {
  it('renders nothing when closed', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a modal dialog named by its title when open', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Log a set' })).toHaveAttribute('aria-modal', 'true')
  })

  it('renders its children', () => {
    setup()
    expect(screen.getByText('Sheet body')).toBeInTheDocument()
  })

  it('closes when the close button is pressed', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Close Log a set' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is pressed', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on the escape key', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('a')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not listen for escape while closed', async () => {
    const { onClose } = setup(false)
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sits at the bottom on the phone and centres at the large breakpoint', () => {
    setup()
    expect(screen.getByRole('dialog')).toHaveClass('rounded-t-[24px]')
    expect(screen.getByRole('dialog')).toHaveClass('lg:rounded-hero')
  })

  it('keeps the close button at 44 px', () => {
    setup()
    const close = screen.getByRole('button', { name: 'Close Log a set' })
    expect(close).toHaveClass('h-11')
    expect(close).toHaveClass('w-11')
  })
})
