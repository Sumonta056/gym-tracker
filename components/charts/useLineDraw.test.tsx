import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setReducedMotion } from '../../tests/fixtures/motion'

import { LABEL_FADE_MS, LINE_DRAW_MS, useLineDraw } from './useLineDraw'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useLineDraw', () => {
  it('draws the lines over 400 ms', () => {
    expect(LINE_DRAW_MS).toBe(400)
  })

  it('draws on first paint when the user has no motion preference', () => {
    setReducedMotion(false)
    const { result } = renderHook(() => useLineDraw())
    expect(result.current).toBe(true)
  })

  it('ends the draw once the line and the label fade are done', () => {
    setReducedMotion(false)
    const { result } = renderHook(() => useLineDraw())
    act(() => {
      vi.advanceTimersByTime(LINE_DRAW_MS + LABEL_FADE_MS)
    })
    expect(result.current).toBe(false)
  })

  it('does not draw again on a re-render', () => {
    setReducedMotion(false)
    const { result, rerender } = renderHook(() => useLineDraw())
    act(() => {
      vi.advanceTimersByTime(LINE_DRAW_MS + LABEL_FADE_MS)
    })
    rerender()
    expect(result.current).toBe(false)
  })

  it('does not draw at all when the user asks for reduced motion', () => {
    setReducedMotion(true)
    const { result } = renderHook(() => useLineDraw())
    expect(result.current).toBe(false)
  })

  it('clears its timer when it unmounts', () => {
    setReducedMotion(false)
    const { unmount } = renderHook(() => useLineDraw())
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
