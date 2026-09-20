import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it('joins the class names it is given', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops a false, null or undefined value', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('drops an empty string', () => {
    expect(cn('', 'a')).toBe('a')
  })

  it('returns an empty string when nothing is given', () => {
    expect(cn()).toBe('')
  })
})
