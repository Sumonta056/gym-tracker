import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setReducedMotion } from '../../tests/fixtures/motion'

import { COUNT_UP_SECONDS, CountUp } from './CountUp'

type Options = {
  duration: number
  onUpdate: (latest: number) => void
  onComplete: () => void
}

const motion = vi.hoisted(() => ({
  calls: [] as { from: number; to: number; options: Options }[],
  stop: vi.fn(),
}))

vi.mock('motion/react', () => ({
  animate: (from: number, to: number, options: Options) => {
    motion.calls.push({ from, to, options })
    return { stop: motion.stop }
  },
}))

function format(value: number): string {
  return `${String(value)} s`
}

function lastCall() {
  const call = motion.calls.at(-1)
  if (call === undefined) {
    throw new Error('animate was not called')
  }
  return call
}

beforeEach(() => {
  motion.calls.length = 0
  motion.stop.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CountUp', () => {
  it('runs no animation when the user asks for reduced motion', () => {
    setReducedMotion(true)
    render(<CountUp value={4325} format={format} />)
    expect(motion.calls).toHaveLength(0)
    expect(screen.queryByTestId('count-up-display')).not.toBeInTheDocument()
  })

  it('puts the final value in the document at once when the user asks for reduced motion', () => {
    setReducedMotion(true)
    render(<CountUp value={4325} format={format} />)
    expect(screen.getByText('4325 s')).toBeVisible()
    expect(screen.getByText('4325 s')).not.toHaveClass('opacity-0')
  })

  it('counts up from zero to the value on first paint', () => {
    setReducedMotion(false)
    render(<CountUp value={4325} format={format} />)
    expect(lastCall()).toMatchObject({ from: 0, to: 4325 })
    expect(lastCall().options.duration).toBe(COUNT_UP_SECONDS)
  })

  it('keeps the final value in the document while the count runs', () => {
    setReducedMotion(false)
    render(<CountUp value={4325} format={format} />)
    expect(screen.getByTestId('count-up-value')).toHaveTextContent('4325 s')
  })

  it('hides the counting display from assistive technology', () => {
    setReducedMotion(false)
    render(<CountUp value={4325} format={format} />)
    expect(screen.getByTestId('count-up-display')).toHaveAttribute('aria-hidden', 'true')
  })

  it('writes each counted value on the display without touching the final value', () => {
    setReducedMotion(false)
    render(<CountUp value={4325} format={format} />)
    act(() => {
      lastCall().options.onUpdate(1200.4)
    })
    expect(screen.getByTestId('count-up-display')).toHaveAttribute('data-count', '1200 s')
    expect(screen.getByTestId('count-up-value')).toHaveTextContent('4325 s')
  })

  it('removes the counting display when the count ends', () => {
    setReducedMotion(false)
    render(<CountUp value={4325} format={format} />)
    act(() => {
      lastCall().options.onComplete()
    })
    expect(screen.queryByTestId('count-up-display')).not.toBeInTheDocument()
    expect(screen.getByTestId('count-up-value')).not.toHaveClass('opacity-0')
  })

  it('does not restart the count on a second render', () => {
    setReducedMotion(false)
    const { rerender } = render(<CountUp value={4325} format={format} />)
    act(() => {
      lastCall().options.onComplete()
    })
    rerender(<CountUp value={4325} format={format} />)
    expect(motion.calls).toHaveLength(1)
  })

  it('shows a new value at once, with no second count, after the first count ends', () => {
    setReducedMotion(false)
    const { rerender } = render(<CountUp value={4325} format={format} />)
    act(() => {
      lastCall().options.onComplete()
    })
    rerender(<CountUp value={5000} format={format} />)
    expect(motion.calls).toHaveLength(1)
    expect(screen.getByText('5000 s')).toBeVisible()
  })

  it('stops the count and shows a new value that arrives mid count', () => {
    setReducedMotion(false)
    const { rerender } = render(<CountUp value={4325} format={format} />)
    rerender(<CountUp value={5000} format={format} />)
    expect(motion.stop).toHaveBeenCalled()
    expect(motion.calls).toHaveLength(1)
    expect(screen.queryByTestId('count-up-display')).not.toBeInTheDocument()
    expect(screen.getByText('5000 s')).toBeVisible()
  })

  it('does not count a zero value', () => {
    setReducedMotion(false)
    render(<CountUp value={0} format={format} />)
    expect(motion.calls).toHaveLength(0)
    expect(screen.getByText('0 s')).toBeVisible()
  })

  it('stops the count when it unmounts', () => {
    setReducedMotion(false)
    const { unmount } = render(<CountUp value={4325} format={format} />)
    unmount()
    expect(motion.stop).toHaveBeenCalled()
  })
})
