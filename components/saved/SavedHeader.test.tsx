import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SavedHeader, savedSummary } from './SavedHeader'

describe('SavedHeader', () => {
  it('names the screen Saved as its 1 heading', () => {
    render(<SavedHeader count={7} categories={4} onSave={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Saved' })).toBeInTheDocument()
  })

  it('shows the count of videos and categories under the heading', () => {
    render(<SavedHeader count={7} categories={4} onSave={vi.fn()} />)

    expect(screen.getByText('7 videos · 4 categories')).toBeInTheDocument()
  })

  it('says 1 video and 1 category in the singular', () => {
    expect(savedSummary(1, 1)).toBe('1 video · 1 category')
    expect(savedSummary(0, 0)).toBe('0 videos · 0 categories')
  })

  it('opens the form from the + Save button', async () => {
    const onSave = vi.fn()
    render(<SavedHeader count={0} categories={0} onSave={onSave} />)

    await userEvent.click(screen.getByRole('button', { name: 'Save a video' }))

    expect(onSave).toHaveBeenCalledOnce()
  })

  it('draws + Save as a 44 px accent pill', () => {
    render(<SavedHeader count={0} categories={0} onSave={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Save a video' })).toHaveClass(
      'min-h-11',
      'rounded-full',
      'bg-accent',
      'text-accent-ink',
    )
  })

  it('puts a slot to the right of + Save for the avatar', () => {
    render(
      <SavedHeader count={0} categories={0} onSave={vi.fn()}>
        <a href="/profile">Profile</a>
      </SavedHeader>,
    )

    const end = screen.getByRole('button', { name: 'Save a video' }).parentElement
    expect(end?.lastElementChild).toBe(screen.getByRole('link', { name: 'Profile' }))
  })
})
