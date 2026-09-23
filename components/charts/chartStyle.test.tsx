import { describe, expect, it } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'

import { AXIS_TICK, LABEL_HALO, REFERENCE_LABEL, REFERENCE_STROKE } from './chartStyle'

describe('chartStyle', () => {
  it('writes the day labels at 11 px in the muted token', () => {
    expect(AXIS_TICK).toMatchObject({ fontSize: 11, fill: colorTokens.muted })
  })

  it('rings each value label in the card surface so a line behind it stays legible', () => {
    expect(LABEL_HALO).toMatchObject({ stroke: colorTokens.surface, paintOrder: 'stroke' })
  })

  it('dashes the reference line in the muted token', () => {
    expect(REFERENCE_STROKE).toMatchObject({ stroke: colorTokens.muted, strokeDasharray: '4 3' })
    expect(REFERENCE_LABEL.fill).toBe(colorTokens.muted)
  })
})
