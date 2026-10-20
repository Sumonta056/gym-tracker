import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WatchPill } from './WatchPill'

const VIDEO = {
  url: 'https://www.youtube.com/results?search_query=Squat%20form',
  kind: 'search',
} as const

describe('WatchPill', () => {
  it('is a link named for the exercise', () => {
    render(<WatchPill name="Squat" video={VIDEO} />)

    expect(screen.getByRole('link', { name: 'Watch Squat' })).toHaveAttribute('href', VIDEO.url)
  })

  it('opens in a new tab with no opener', () => {
    render(<WatchPill name="Squat" video={VIDEO} />)
    const link = screen.getByRole('link', { name: 'Watch Squat' })

    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
  })

  it('keeps a 44 px target', () => {
    render(<WatchPill name="Squat" video={VIDEO} />)

    expect(screen.getByRole('link', { name: 'Watch Squat' })).toHaveClass('min-h-11', 'min-w-11')
  })
})
