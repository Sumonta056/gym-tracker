import { describe, expect, it } from 'vitest'

import { compactNumber } from './compactNumber'

describe('compactNumber', () => {
  const cases: { value: number; text: string }[] = [
    { value: 0, text: '0' },
    { value: 985, text: '985' },
    { value: 999, text: '999' },
    { value: 705.7, text: '706' },
    { value: 1000, text: '1k' },
    { value: 9120, text: '9.1k' },
    { value: 9904, text: '9.9k' },
    { value: 9960, text: '10k' },
    { value: 12000, text: '12k' },
    { value: 12480, text: '12.5k' },
    { value: 200000, text: '200k' },
    { value: 999960, text: '1M' },
    { value: 1250000, text: '1.3M' },
    { value: -1500, text: '-1.5k' },
  ]

  it.each(cases)('writes $value as $text', ({ value, text }) => {
    expect(compactNumber(value)).toBe(text)
  })
})
