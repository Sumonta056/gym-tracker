import { describe, expect, it } from 'vitest'

import { isValidEmail, normaliseEmail } from './email'

describe('normaliseEmail', () => {
  it('trims the surrounding space', () => {
    expect(normaliseEmail('  you@example.com  ')).toBe('you@example.com')
  })

  it('lower cases the address', () => {
    expect(normaliseEmail('You@Example.COM')).toBe('you@example.com')
  })
})

describe('isValidEmail', () => {
  it('accepts an ordinary address', () => {
    expect(isValidEmail('you@example.com')).toBe(true)
  })

  it('accepts an address with a subdomain', () => {
    expect(isValidEmail('you@mail.example.co.uk')).toBe(true)
  })

  it('accepts an address that only needs trimming', () => {
    expect(isValidEmail('  you@example.com ')).toBe(true)
  })

  it('returns false for an empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('returns false when the at sign is missing', () => {
    expect(isValidEmail('you.example.com')).toBe(false)
  })

  it('returns false when the domain has no dot', () => {
    expect(isValidEmail('you@example')).toBe(false)
  })

  it('returns false when the address holds a space', () => {
    expect(isValidEmail('you me@example.com')).toBe(false)
  })

  it('returns false for an address longer than 254 characters', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })
})
