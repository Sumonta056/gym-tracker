import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CATEGORY_COLORS } from '../../lib/schema/videoCategory'
import { ALL } from '../../lib/videos/list'

import { CATEGORY_DOT, CategoryChips } from './CategoryChips'

import type { CategoryChip } from '../../lib/videos/list'

const CHIPS: CategoryChip[] = [
  { id: ALL, name: 'All', color: null, count: 3 },
  { id: 'gym', name: 'Gym tricks', color: 'data-violet', count: 2 },
  { id: 'home', name: 'Home', color: 'data-blue', count: 1 },
]

describe('CategoryChips', () => {
  it('maps every category color to a static token class', () => {
    for (const color of CATEGORY_COLORS) {
      expect(CATEGORY_DOT[color]).toBe(`bg-${color}`)
    }
  })

  it('shows 1 toggle per chip with the name and the count', () => {
    render(<CategoryChips chips={CHIPS} selected={ALL} onSelect={vi.fn()} />)

    const group = screen.getByRole('group', { name: 'Category' })
    expect(group).toHaveTextContent('All 3')
    expect(screen.getByRole('button', { name: 'Gym tricks 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home 1' })).toBeInTheDocument()
  })

  it('marks the selected chip with aria-pressed and the accent fill', () => {
    render(<CategoryChips chips={CHIPS} selected="gym" onSelect={vi.fn()} />)

    const gym = screen.getByRole('button', { name: 'Gym tricks 2' })
    expect(gym).toHaveAttribute('aria-pressed', 'true')
    expect(gym).toHaveClass('bg-accent', 'text-accent-ink')
    expect(screen.getByRole('button', { name: 'All 3' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('draws the category dot from the map and none on All', () => {
    render(<CategoryChips chips={CHIPS} selected={ALL} onSelect={vi.fn()} />)

    const dots = screen.getAllByTestId('category-dot')
    expect(dots).toHaveLength(2)
    expect(dots[0]).toHaveClass('bg-data-violet')
    expect(dots[1]).toHaveClass('bg-data-blue')
  })

  it('scrolls sideways inside its own box', () => {
    render(<CategoryChips chips={CHIPS} selected={ALL} onSelect={vi.fn()} />)

    expect(screen.getByTestId('category-chips')).toHaveClass('overflow-x-auto')
  })

  it('selects a chip on tap', async () => {
    const onSelect = vi.fn()
    render(<CategoryChips chips={CHIPS} selected={ALL} onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('button', { name: 'Home 1' }))

    expect(onSelect).toHaveBeenCalledWith('home')
  })

  it('makes every chip 44 px tall', () => {
    render(<CategoryChips chips={CHIPS} selected={ALL} onSelect={vi.fn()} />)

    for (const chip of screen.getAllByRole('button')) {
      expect(chip).toHaveClass('min-h-11')
    }
  })
})
