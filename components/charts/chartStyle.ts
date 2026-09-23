import { colorTokens } from '../../lib/design/tokens'

export const AXIS_TICK = {
  fill: colorTokens.muted,
  fontSize: 11,
  fontWeight: 600,
}

export const RANGE_TICK = {
  fill: colorTokens.muted,
  fontSize: 10,
  fontWeight: 600,
}

export const LABEL_HALO = {
  fontSize: 11,
  fontWeight: 700,
  stroke: colorTokens.surface,
  strokeWidth: 3,
  strokeLinejoin: 'round',
  paintOrder: 'stroke',
} as const

export const REFERENCE_STROKE = {
  stroke: colorTokens.muted,
  strokeWidth: 1,
  strokeDasharray: '4 3',
}

export const REFERENCE_LABEL = {
  fill: colorTokens.muted,
  fontSize: 11,
  fontWeight: 600,
}

export const REFERENCE_GUTTER = 58

export const END_LABEL_GUTTER = 34
