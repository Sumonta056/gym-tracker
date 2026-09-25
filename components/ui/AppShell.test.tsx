import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AppShell } from './AppShell'

const ITEMS = [
  { href: '/', label: 'Today', glyph: '◧', current: true },
  { href: '/history', label: 'History', glyph: '◔' },
  { href: '/body', label: 'Body', glyph: '⛊' },
  { href: '/settings', label: 'Settings', glyph: '☰' },
]

function setup() {
  render(
    <AppShell items={ITEMS} action={{ href: '/log', label: 'Log a set', glyph: '✎' }} title="Today">
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

  it('pins the sidebar to the viewport, so it stays in view on a long page', () => {
    setup()
    const sidebar = screen.getByRole('navigation', { name: 'Sidebar' })
    expect(sidebar).toHaveClass('lg:sticky', 'lg:top-0', 'lg:h-dvh', 'lg:overflow-y-auto')
  })

  it('sets the page title at the screen title size: 23 px, bold, tight tracking', () => {
    setup()
    const title = screen.getByRole('heading', { level: 1, name: 'Today' })
    expect(title).toHaveClass('text-[23px]', 'font-bold', 'tracking-[-0.6px]')
    expect(title).not.toHaveClass('text-2xl')
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
      'pb-[calc(env(safe-area-inset-bottom)+10px)]',
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
      expect(link.className).toMatch(/min-h-11|min-h-\[52px\]|min-h-\[54px\]/)
    }
  })

  it('lays the bottom bar out as five equal slots', () => {
    setup()
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    expect(bar).toHaveClass('grid')
    expect(bar).toHaveClass('auto-cols-fr')
    expect(within(bar).getAllByRole('link')).toHaveLength(5)
  })

  it('hides every glyph from the screen reader, so the label carries the meaning', () => {
    setup()
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    const glyphs = bar.querySelectorAll('[aria-hidden="true"]')
    expect(glyphs).toHaveLength(5)
    expect(within(bar).getByRole('link', { name: 'Today' })).toBeInTheDocument()
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

  it('marks the centre action as the current page when it is current', () => {
    render(
      <AppShell items={ITEMS} action={{ href: '/log', label: 'Log a set', current: true }}>
        <p>Page body</p>
      </AppShell>,
    )
    for (const link of screen.getAllByRole('link', { name: 'Log a set' })) {
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('leaves the centre action unmarked when it is not current', () => {
    setup()
    for (const link of screen.getAllByRole('link', { name: 'Log a set' })) {
      expect(link).not.toHaveAttribute('aria-current')
    }
  })

  it('renders no action button when none is given', () => {
    render(
      <AppShell items={ITEMS}>
        <p>Page body</p>
      </AppShell>,
    )
    expect(screen.queryByRole('link', { name: 'Log a set' })).not.toBeInTheDocument()
  })

  it('gives every tab bar link a short press feedback that only runs with motion allowed', () => {
    setup()
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    for (const link of within(bar).getAllByRole('link')) {
      expect(link).toHaveClass('motion-safe:active:scale-95')
      expect(link).toHaveClass('motion-safe:transition-transform')
      expect(link).toHaveClass('motion-safe:duration-100')
    }
  })

  it('keeps every tab bar target 44 px or taller with the press feedback', () => {
    setup()
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    for (const link of within(bar).getAllByRole('link')) {
      expect(link.className).toMatch(/min-h-\[5[24]px\]/)
    }
  })

  it('lets a tab bar link respond to a tap at once', async () => {
    setup()
    const onClick = vi.fn((event: MouseEvent) => {
      event.preventDefault()
    })
    const bar = screen.getByRole('navigation', { name: 'Bottom navigation' })
    const link = within(bar).getByRole('link', { name: 'History' })
    link.addEventListener('click', onClick)
    await userEvent.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('wraps the page in a transition keyed by the route when given one', () => {
    render(
      <AppShell items={ITEMS} transitionKey="/">
        <p>Page body</p>
      </AppShell>,
    )
    expect(screen.getByTestId('page-transition')).toContainElement(screen.getByText('Page body'))
  })

  it('renders the page with no transition when no route key is given', () => {
    setup()
    expect(screen.queryByTestId('page-transition')).not.toBeInTheDocument()
  })
})
