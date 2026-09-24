import { afterEach, describe, expect, it, vi } from 'vitest'

import { setReducedMotion } from '../../tests/fixtures/motion'

import { prefersReducedMotion, REDUCED_MOTION_QUERY } from './reducedMotion'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('prefersReducedMotion', () => {
  it('returns true when the user asks for reduced motion', () => {
    setReducedMotion(true)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('returns false when the user has no motion preference', () => {
    setReducedMotion(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('asks the media query for reduced motion', () => {
    const matchMedia = vi.fn(() => ({ matches: false }))
    vi.stubGlobal('matchMedia', matchMedia)
    prefersReducedMotion()
    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY)
  })

  it('returns false when the browser cannot answer a media query', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })
})
