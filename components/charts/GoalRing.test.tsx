import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GoalRing, ringFill } from './GoalRing'

describe('ringFill', () => {
  it('fills the share of the ring that matches the percent', () => {
    expect(ringFill(50)).toBeCloseTo(Math.PI * 30)
  })

  it('caps the fill at a full ring past 100 percent', () => {
    expect(ringFill(200)).toBeCloseTo(2 * Math.PI * 30)
  })

  it('draws no fill below 0 percent', () => {
    expect(ringFill(-10)).toBe(0)
  })
})

describe('GoalRing', () => {
  it('shows the real percent as text past the goal', () => {
    render(<GoalRing percent={200} tone="cyan" />)
    expect(screen.getByText('200%')).toBeInTheDocument()
  })

  it('names the percent as a share of the goal for a screen reader', () => {
    render(<GoalRing percent={80} tone="warn" />)
    expect(screen.getByText('of goal')).toHaveClass('sr-only')
  })

  it('hides the ring drawing from assistive technology', () => {
    const { container } = render(<GoalRing percent={80} tone="warn" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('colours the fill with the tone token', () => {
    render(<GoalRing percent={80} tone="violet" />)
    expect(screen.getByTestId('goal-ring-fill')).toHaveClass('stroke-data-violet')
  })

  it('draws only the track at 0 percent', () => {
    render(<GoalRing percent={0} tone="cyan" />)
    expect(screen.queryByTestId('goal-ring-fill')).toBeNull()
  })
})
