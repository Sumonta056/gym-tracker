import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { VideoMenu } from './VideoMenu'

function show() {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(
    <>
      <VideoMenu title="Grip trick" onEdit={onEdit} onDelete={onDelete} />
      <button type="button">Elsewhere</button>
    </>,
  )
  return { onEdit, onDelete, toggle: screen.getByRole('button', { name: 'More for Grip trick' }) }
}

describe('VideoMenu', () => {
  it('starts closed, with a 44 px button named for the video', () => {
    const { toggle } = show()

    expect(toggle).toHaveClass('size-11')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('opens Edit and Delete, and moves focus to Edit', async () => {
    const { toggle } = show()

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('group', { name: 'Actions for Grip trick' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('min-h-11', 'text-danger')
  })

  it('calls Edit and closes', async () => {
    const { toggle, onEdit } = show()

    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(onEdit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('calls Delete and closes', async () => {
    const { toggle, onDelete } = show()

    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('closes on Escape and gives focus back to the button', async () => {
    const { toggle } = show()

    await userEvent.click(toggle)
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })

  it('closes on a tap outside', async () => {
    const { toggle } = show()

    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }))

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('stays open on a tap inside', async () => {
    const { toggle } = show()

    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('group', { name: 'Actions for Grip trick' }))

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('closes when the button is pressed again', async () => {
    const { toggle } = show()

    await userEvent.click(toggle)
    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
