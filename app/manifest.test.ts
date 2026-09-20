import { describe, expect, it } from 'vitest'

import { colorTokens } from '../lib/design/tokens'

import manifest from './manifest'

describe('manifest', () => {
  it('names the app and its short name', () => {
    const value = manifest()
    expect(value.name).toBe('Gym Tracker')
    expect(value.short_name).toBe('Gym')
  })

  it('installs as a standalone portrait app from the root', () => {
    const value = manifest()
    expect(value.display).toBe('standalone')
    expect(value.orientation).toBe('portrait')
    expect(value.start_url).toBe('/')
    expect(value.scope).toBe('/')
  })

  it('uses the ground token for both colours', () => {
    const value = manifest()
    expect(value.background_color?.toLowerCase()).toBe(colorTokens.ground)
    expect(value.theme_color?.toLowerCase()).toBe(colorTokens.ground)
  })

  it('ships a 192, a 512 and a maskable 512 icon', () => {
    const icons = manifest().icons ?? []
    expect(icons.map((icon) => `${String(icon.sizes)} ${String(icon.purpose)}`)).toEqual([
      '192x192 any',
      '512x512 any',
      '512x512 maskable',
    ])
  })
})
