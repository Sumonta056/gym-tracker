import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readStandalone, STANDALONE_QUERY, useStandalone } from './useStandalone'

type Listener = () => void

function stubMedia(matches: boolean) {
  const listeners = new Set<Listener>()
  const media = {
    matches,
    addEventListener: (_: string, listener: Listener) => {
      listeners.add(listener)
    },
    removeEventListener: (_: string, listener: Listener) => {
      listeners.delete(listener)
    },
  }
  const matchMedia = vi.fn(() => media)
  vi.stubGlobal('matchMedia', matchMedia)

  return {
    matchMedia,
    listeners,
    flip(next: boolean) {
      media.matches = next
      for (const listener of listeners) listener()
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window.navigator, 'standalone')
})

describe('useStandalone', () => {
  it('reads false in a browser tab', () => {
    stubMedia(false)

    expect(renderHook(() => useStandalone()).result.current).toBe(false)
  })

  it('reads true when the display mode is standalone', () => {
    const { matchMedia } = stubMedia(true)

    expect(renderHook(() => useStandalone()).result.current).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith(STANDALONE_QUERY)
  })

  it('reads true from navigator.standalone on an older iPhone', () => {
    stubMedia(false)
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true })

    expect(renderHook(() => useStandalone()).result.current).toBe(true)
  })

  it('follows a change of display mode', () => {
    const media = stubMedia(false)
    const { result } = renderHook(() => useStandalone())

    act(() => {
      media.flip(true)
    })

    expect(result.current).toBe(true)
  })

  it('stops listening on unmount', () => {
    const media = stubMedia(false)
    const { unmount } = renderHook(() => useStandalone())

    unmount()

    expect(media.listeners.size).toBe(0)
  })

  it('reads false in a browser with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(readStandalone()).toBe(false)
    expect(renderHook(() => useStandalone()).result.current).toBe(false)
  })
})
