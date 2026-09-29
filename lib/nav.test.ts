import { describe, expect, it } from 'vitest'

import { isCurrentPath, NAV_ACTION, NAV_DESTINATIONS } from './nav'

describe('NAV_DESTINATIONS', () => {
  it('holds the four destinations that sit beside the centre action', () => {
    expect(NAV_DESTINATIONS.map((item) => item.href)).toEqual([
      '/',
      '/analytics',
      '/workouts',
      '/profile',
    ])
  })

  it('gives every destination a label and a glyph', () => {
    for (const item of NAV_DESTINATIONS) {
      expect(item.label).not.toBe('')
      expect(item.glyph).not.toBe('')
    }
  })
})

describe('NAV_ACTION', () => {
  it('points the centre action at the daily log', () => {
    expect(NAV_ACTION.href).toBe('/log')
  })

  it('stays out of the four destinations, so no slot repeats', () => {
    expect(NAV_DESTINATIONS.map((item) => item.href)).not.toContain(NAV_ACTION.href)
  })
})

describe('isCurrentPath', () => {
  it('matches the root only on the root itself', () => {
    expect(isCurrentPath('/', '/')).toBe(true)
  })

  it('does not match the root on a deeper path', () => {
    expect(isCurrentPath('/analytics', '/')).toBe(false)
  })

  it('matches a destination on its own path', () => {
    expect(isCurrentPath('/analytics', '/analytics')).toBe(true)
  })

  it('matches a destination on a child path', () => {
    expect(isCurrentPath('/workouts/2026-09-23', '/workouts')).toBe(true)
  })

  it('does not match a path that only shares a prefix', () => {
    expect(isCurrentPath('/profiles', '/profile')).toBe(false)
  })

  it('marks the Workouts tab current on the live workout screen', () => {
    expect(isCurrentPath('/workout', '/workouts')).toBe(true)
  })

  it('marks the Workouts tab current below the live workout screen', () => {
    expect(isCurrentPath('/workout/set', '/workouts')).toBe(true)
  })

  it('does not mark the Workouts tab on a path that only shares the prefix', () => {
    expect(isCurrentPath('/workouter', '/workouts')).toBe(false)
  })

  it('marks no other destination current on the live workout screen', () => {
    const current = [...NAV_DESTINATIONS, NAV_ACTION].filter((item) =>
      isCurrentPath('/workout', item.href),
    )

    expect(current.map((item) => item.href)).toEqual(['/workouts'])
  })
})
