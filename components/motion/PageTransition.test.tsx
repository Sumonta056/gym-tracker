import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setReducedMotion } from '../../tests/fixtures/motion'

import { PAGE_ENTER, PAGE_REST, PAGE_TRANSITION_SECONDS, PageTransition } from './PageTransition'

afterEach(() => {
  vi.unstubAllGlobals()
})

function page(routeKey: string, onPress = () => undefined) {
  return (
    <PageTransition routeKey={routeKey}>
      <button type="button" onClick={onPress}>
        {`Page ${routeKey}`}
      </button>
    </PageTransition>
  )
}

function frame(): HTMLElement {
  return screen.getByTestId('page-transition')
}

describe('PageTransition', () => {
  it('shows the first page at rest, with no entry fade', () => {
    setReducedMotion(false)
    render(page('/'))
    expect(frame().style.opacity).not.toBe('0')
  })

  it('fades the next page in from below after a navigation', () => {
    setReducedMotion(false)
    const { rerender } = render(page('/'))
    rerender(page('/log'))
    expect(screen.getByText('Page /log')).toBeInTheDocument()
    expect(frame().style.opacity).toBe('0')
    expect(frame().style.transform).toContain('translateY(8px)')
  })

  it('runs no page transition when the user asks for reduced motion', () => {
    setReducedMotion(true)
    const { rerender } = render(page('/'))
    rerender(page('/log'))
    expect(frame().style.opacity).not.toBe('0')
    expect(frame().style.transform).not.toContain('translateY')
  })

  it('lasts 180 ms', () => {
    expect(PAGE_TRANSITION_SECONDS).toBe(0.18)
  })

  it('moves only opacity and transform, so the layout never shifts', () => {
    expect(Object.keys(PAGE_ENTER).sort()).toEqual(['opacity', 'y'])
    expect(Object.keys(PAGE_REST).sort()).toEqual(['opacity', 'y'])
  })

  it('lets a button on the entering page respond to a tap at once', async () => {
    setReducedMotion(false)
    const onPress = vi.fn()
    const { rerender } = render(page('/'))
    rerender(page('/log', onPress))
    await userEvent.click(screen.getByRole('button', { name: 'Page /log' }))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(frame().style.pointerEvents).toBe('')
  })
})
