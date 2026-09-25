import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppNav } from './AppNav'

const pathname = vi.hoisted(() => ({ value: '/' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
}))

function setup(path: string) {
  pathname.value = path
  render(
    <AppNav>
      <p>Page body</p>
    </AppNav>,
  )
}

describe('AppNav', () => {
  it('renders its children', () => {
    setup('/')
    expect(screen.getByText('Page body')).toBeInTheDocument()
  })

  it('renders the five slots in order, with the log action in the centre', () => {
    setup('/')
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    const hrefs = within(bar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual(['/', '/analytics', '/log', '/workouts', '/profile'])
  })

  it('marks the root as the current page on the root path', () => {
    setup('/')
    for (const link of screen.getAllByRole('link', { name: 'Today' })) {
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('marks the stats destination as the current page on the analytics path', () => {
    setup('/analytics')
    for (const link of screen.getAllByRole('link', { name: 'Stats' })) {
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('marks no other destination when one destination is current', () => {
    setup('/analytics')
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    const marked = within(bar)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(marked).toHaveLength(1)
  })

  it('marks the centre action as the current page on the log path', () => {
    setup('/log')
    for (const link of screen.getAllByRole('link', { name: 'Log the day' })) {
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('marks no destination beside the centre action on the log path', () => {
    setup('/log')
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    const marked = within(bar)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(marked.map((link) => link.getAttribute('href'))).toEqual(['/log'])
  })

  it('marks the workouts destination on a child path', () => {
    setup('/workouts/2026-09-23')
    for (const link of screen.getAllByRole('link', { name: 'Workouts' })) {
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('wraps the page in the route transition', () => {
    setup('/log')
    expect(screen.getByTestId('page-transition')).toContainElement(screen.getByText('Page body'))
  })
})
