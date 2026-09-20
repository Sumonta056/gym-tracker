export const colorTokens = {
  ground: '#0b0b0d',
  surface: '#15151a',
  'surface-2': '#1e1e25',
  border: '#24242c',
  text: '#f4f4f7',
  muted: '#8c8c99',
  dim: '#6e6e7b',
  accent: '#c6f135',
  'accent-ink': '#10160a',
  'data-cyan': '#22d3ee',
  'data-violet': '#a78bfa',
  warn: '#fb923c',
  danger: '#f87171',
  ok: '#4ade80',
} as const

export type ColorTokenName = keyof typeof colorTokens

export const radiusTokens = {
  card: '20px',
  hero: '24px',
  input: '16px',
} as const

export const chartPalette = [
  colorTokens['data-cyan'],
  colorTokens['data-violet'],
  colorTokens.accent,
  colorTokens.warn,
  colorTokens.danger,
  colorTokens.ok,
] as const

export const chartAxis = {
  grid: colorTokens.border,
  tick: colorTokens.muted,
  label: colorTokens.dim,
} as const
