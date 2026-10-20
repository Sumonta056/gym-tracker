import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { stepLabel, StepProgress } from './StepProgress'

const NAMES = ['Incline Dumbbell Press', 'Flat Dumbbell Press', 'Incline Dumbbell Fly', 'Pullover']

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('stepLabel', () => {
  it('reads the number, the name and the status', () => {
    expect(stepLabel(1, 'Flat Dumbbell Press', 'now')).toBe('Step 2, Flat Dumbbell Press: now')
  })

  it('reads to do for a step not reached', () => {
    expect(stepLabel(2, 'Incline Dumbbell Fly', 'todo')).toBe('Step 3, Incline Dumbbell Fly: to do')
  })
})

describe('StepProgress', () => {
  it('renders 1 bar per step in an ordered list named Steps', () => {
    render(<StepProgress names={NAMES} statuses={['done', 'now', 'skipped', 'todo']} />)

    const list = screen.getByRole('list', { name: 'Steps' })
    expect(list.tagName).toBe('OL')
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
  })

  it('gives each bar a hidden label with its status', () => {
    render(<StepProgress names={NAMES} statuses={['done', 'now', 'skipped', 'todo']} />)

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Step 1, Incline Dumbbell Press: done')
    expect(items[1]).toHaveTextContent('Step 2, Flat Dumbbell Press: now')
    expect(items[2]).toHaveTextContent('Step 3, Incline Dumbbell Fly: skipped')
    expect(items[3]).toHaveTextContent('Step 4, Pullover: to do')
  })

  it('colours a bar from its status', () => {
    render(<StepProgress names={NAMES} statuses={['done', 'now', 'skipped', 'todo']} />)

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveAttribute('data-state', 'done')
    expect(items[0]).toHaveClass('bg-accent')
    expect(items[2]).toHaveClass('bg-dim')
    expect(items[3]).toHaveClass('bg-surface-2')
  })

  it('moves the fill of the current bar', () => {
    mockReducedMotion(false)
    const { container } = render(<StepProgress names={NAMES} statuses={['done', 'now']} />)

    expect(container.querySelector('[data-fill="moving"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-fill]')).toHaveLength(1)
  })

  it('holds the fill still under reduced motion', () => {
    mockReducedMotion(true)
    const { container } = render(<StepProgress names={NAMES} statuses={['now']} />)

    expect(container.querySelector('[data-fill="still"]')).toHaveClass('scale-x-50')
    expect(container.querySelector('[data-fill="moving"]')).toBeNull()
  })

  it('keeps a bar with no name readable', () => {
    render(<StepProgress names={[]} statuses={['todo']} />)

    expect(screen.getByRole('listitem')).toHaveTextContent('Step 1, : to do')
  })
})
