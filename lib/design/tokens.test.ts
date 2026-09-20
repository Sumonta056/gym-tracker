import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { chartAxis, chartPalette, colorTokens, radiusTokens } from './tokens'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

function readTheme(prefix: string): Record<string, string> {
  const block = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)
  expect(block).not.toBeNull()

  const body = block?.[1] ?? ''
  const declaration = new RegExp(`--${prefix}-([a-z0-9-]+):\\s*([^;]+);`, 'g')
  const found: Record<string, string> = {}

  for (const match of body.matchAll(declaration)) {
    const name = match[1]
    const value = match[2]
    if (name !== undefined && value !== undefined) {
      found[name] = value.trim()
    }
  }

  return found
}

describe('colorTokens', () => {
  it('matches every --color token declared in app/globals.css', () => {
    expect(readTheme('color')).toEqual(colorTokens)
  })

  it('uses lower case six digit hex for every value', () => {
    for (const value of Object.values(colorTokens)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('radiusTokens', () => {
  it('matches every --radius token declared in app/globals.css', () => {
    expect(readTheme('radius')).toEqual(radiusTokens)
  })
})

describe('chartPalette', () => {
  it('only contains values from colorTokens', () => {
    const allowed = new Set<string>(Object.values(colorTokens))
    for (const value of chartPalette) {
      expect(allowed.has(value)).toBe(true)
    }
  })

  it('has no duplicate series color', () => {
    expect(new Set(chartPalette).size).toBe(chartPalette.length)
  })
})

describe('chartAxis', () => {
  it('only contains values from colorTokens', () => {
    const allowed = new Set<string>(Object.values(colorTokens))
    for (const value of Object.values(chartAxis)) {
      expect(allowed.has(value)).toBe(true)
    }
  })
})
