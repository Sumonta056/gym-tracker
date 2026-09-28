export function roundTo2(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}
