import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RestSoundCard, soundStatement } from './RestSoundCard'

describe('RestSoundCard', () => {
  it('groups the two choices under a label and presses the current one', () => {
    render(<RestSoundCard muted={false} onMutedChange={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Rest sound' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Muted' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('states the muted setting in text, not by colour alone', () => {
    render(<RestSoundCard muted onMutedChange={vi.fn()} />)

    expect(screen.getByText(soundStatement(true))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Muted' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hands muted to its owner', async () => {
    const onMutedChange = vi.fn()
    render(<RestSoundCard muted={false} onMutedChange={onMutedChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Muted' }))

    expect(onMutedChange).toHaveBeenCalledWith(true)
  })

  it('hands sound on to its owner', async () => {
    const onMutedChange = vi.fn()
    render(<RestSoundCard muted onMutedChange={onMutedChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Sound on' }))

    expect(onMutedChange).toHaveBeenCalledWith(false)
  })

  it('shows an error the owner reports', () => {
    render(<RestSoundCard muted={false} onMutedChange={vi.fn()} error="Not saved." />)

    expect(screen.getByRole('alert')).toHaveTextContent('Not saved.')
  })
})

describe('soundStatement', () => {
  it('says a sound plays when the sound is on', () => {
    expect(soundStatement(false)).toBe('A short sound plays when a rest ends.')
  })
})
