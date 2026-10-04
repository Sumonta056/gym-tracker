import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthHeader } from './AuthHeader'

describe('AuthHeader', () => {
  it('names the app as the one level 1 heading', () => {
    render(<AuthHeader />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Gym Tracker' })).toBeInTheDocument()
  })

  it('carries the tagline at the prototype 13 px', () => {
    render(<AuthHeader />)
    expect(screen.getByText('One log. Works with no signal in the gym.')).toHaveClass('text-[13px]')
  })

  it('hides the brand mark from assistive technology', () => {
    render(<AuthHeader />)
    expect(screen.getByText('GT')).toHaveAttribute('aria-hidden', 'true')
  })
})
