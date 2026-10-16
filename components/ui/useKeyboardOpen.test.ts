import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { isKeyboardOpen, KEYBOARD_GAP_PX, useKeyboardOpen } from './useKeyboardOpen'

class FakeViewport extends EventTarget {
  height: number
  scale = 1

  constructor(height: number) {
    super()
    this.height = height
  }

  resize(height: number, scale = 1): void {
    this.height = height
    this.scale = scale
    this.dispatchEvent(new Event('resize'))
  }
}

const INNER_HEIGHT = 800

function installViewport(height: number): FakeViewport {
  const viewport = new FakeViewport(height)
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: INNER_HEIGHT })
  return viewport
}

function removeViewport(): void {
  Reflect.deleteProperty(window, 'visualViewport')
}

afterEach(() => {
  removeViewport()
})

describe('isKeyboardOpen', () => {
  it('reads closed when the browser has no visual viewport', () => {
    removeViewport()
    expect(isKeyboardOpen()).toBe(false)
  })

  it('reads closed when the visual viewport fills the window', () => {
    installViewport(INNER_HEIGHT)
    expect(isKeyboardOpen()).toBe(false)
  })

  it('reads closed for a gap of exactly the threshold, such as a toolbar', () => {
    installViewport(INNER_HEIGHT - KEYBOARD_GAP_PX)
    expect(isKeyboardOpen()).toBe(false)
  })

  it('reads open when the visual viewport is more than 150 px shorter than the window', () => {
    installViewport(INNER_HEIGHT - KEYBOARD_GAP_PX - 1)
    expect(isKeyboardOpen()).toBe(true)
  })

  it('reads closed while the page is pinch zoomed with no keyboard', () => {
    const viewport = installViewport(INNER_HEIGHT)
    viewport.resize(INNER_HEIGHT / 2, 2)
    expect(isKeyboardOpen()).toBe(false)
  })
})

describe('useKeyboardOpen', () => {
  it('returns false with no visual viewport', () => {
    removeViewport()
    const { result } = renderHook(() => useKeyboardOpen())
    expect(result.current).toBe(false)
  })

  it('follows the visual viewport as the keyboard opens and closes', () => {
    const viewport = installViewport(INNER_HEIGHT)
    const { result } = renderHook(() => useKeyboardOpen())
    expect(result.current).toBe(false)

    act(() => {
      viewport.resize(450)
    })
    expect(result.current).toBe(true)

    act(() => {
      viewport.resize(INNER_HEIGHT)
    })
    expect(result.current).toBe(false)
  })

  it('stops listening once unmounted', () => {
    const viewport = installViewport(INNER_HEIGHT)
    const { result, unmount } = renderHook(() => useKeyboardOpen())
    unmount()

    viewport.resize(450)
    expect(result.current).toBe(false)
  })

  it('renders closed on the server', () => {
    installViewport(450)

    function Probe() {
      return createElement('span', null, useKeyboardOpen() ? 'open' : 'closed')
    }

    expect(renderToString(createElement(Probe))).toBe('<span>closed</span>')
  })
})
