function oneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function compactNumber(value: number): string {
  const size = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (Math.round(size) < 1000) {
    return `${sign}${String(Math.round(size))}`
  }

  const thousands = Math.round(size / 100) / 10

  if (thousands < 1000) {
    return `${sign}${oneDecimal(thousands)}k`
  }

  return `${sign}${oneDecimal(size / 1000000)}M`
}
