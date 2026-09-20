import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppShell } from './AppShell'

const ITEMS = [
  { href: '/', label: 'Today', current: true },
  { href: '/history', label: 'History' },
  { href: '/body', label: 'Body' },
  { href: '/settings', label: 'Settings' },
]

function setup() {
  render(
    <AppShell items={ITEMS} action={{ href: '/log', label: 'Log a set' }} title="Today">
      <p>Page body</p>
    </AppShell>,
  )
}

describe('AppShell', () => {
  it('renders its children', () => {
    setup()
    expect(screen.getByText('Page body')).toBeInTheDocument()
  })

  it('renders the page title as the single first level heading', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
  })

  it('renders a sidebar that only shows at the large breakpoint', () => {
    setup()
    const sidebar = screen.getByRole('navigation', { name: 'Sidebar' })
    expect(sidebar).toHaveClass('hidden')
    expect(sidebar).toHaveClass('lg:flex')
    expect(sidebar).toHaveClass('lg:w-60')
  })

  it('renders a bottom bar that hides at the large breakpoint', () => {
    setup()
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    expect(bar).toHaveClass('lg:hidden')
    expect(bar).toHaveClass('fixed')
  })

  it('pads the bottom bar for the safe area inset', () => {
    setup()
    expect(screen.getByRole('navigation', { name: 'Bottom navigation' })).toHaveClass(
      'pb-[calc(env(safe-area-inset-bottom)+8px)]',
    )
  })

  it('puts the centre action button between the two halves of the bar', () => {
    setup()
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    const labels = within(bar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(labels).toEqual(['/', '/history', '/log', '/body', '/settings'])
  })

  it('marks the current item on both navigations', () => {
    setup()
    const current = screen.getAllByRole('link', { name: 'Today' })
    expect(current).toHaveLength(2)
    for (const link of current) {
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('keeps every navigation target at least 44 px tall', () => {
    setup()
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toMatch(/min-h-11|h-14/)
    }
  })

  it('caps the content column at 1100 px and centres it', () => {
    setup()
    const main = screen.getByRole('main')
    expect(main).toHaveClass('max-w-[1100px]')
    expect(main).toHaveClass('mx-auto')
  })

  it('uses 20 px gutters on the phone and 28 px from the medium breakpoint', () => {
    setup()
    const main = screen.getByRole('main')
    expect(main).toHaveClass('px-5')
    expect(main).toHaveClass('md:px-7')
  })

  it('renders no action button when none is given', () => {
    render(
      <AppShell items={ITEMS}>
        <p>Page body</p>
      </AppShell>,
    )
    expect(screen.queryByRole('link', { name: 'Log a set' })).not.toBeInTheDocument()
  })
})
