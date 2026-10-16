import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BottomNav } from './BottomNav'

class FakeViewport extends EventTarget {
  height = 800
  scale = 1

  resize(height: number): void {
    this.height = height
    this.dispatchEvent(new Event('resize'))
  }
}

function installViewport(): FakeViewport {
  const viewport = new FakeViewport()
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  return viewport
}

afterEach(() => {
  Reflect.deleteProperty(window, 'visualViewport')
})

describe('BottomNav', () => {
  it('shows its links while no keyboard is open', () => {
    installViewport()
    render(
      <BottomNav aria-label="Bottom navigation" className="fixed">
        <a href="/log">Log</a>
      </BottomNav>,
    )
    const nav = screen.getByRole('navigation', { name: 'Bottom navigation' })
    expect(nav).toBeVisible()
    expect(nav).toHaveClass('fixed')
    expect(nav).not.toHaveAttribute('data-keyboard')
  })

  it('hides itself while the on-screen keyboard is open, and comes back when it closes', () => {
    const viewport = installViewport()
    render(
      <BottomNav aria-label="Bottom navigation">
        <a href="/log">Log</a>
      </BottomNav>,
    )

    act(() => {
      viewport.resize(400)
    })
    expect(screen.queryByRole('navigation', { name: 'Bottom navigation' })).toBeNull()
    expect(document.querySelector('nav')).toHaveAttribute('data-keyboard', 'open')

    act(() => {
      viewport.resize(800)
    })
    expect(screen.getByRole('navigation', { name: 'Bottom navigation' })).toBeVisible()
  })
})
