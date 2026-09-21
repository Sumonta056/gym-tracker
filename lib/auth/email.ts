const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string): boolean {
  const candidate = normaliseEmail(value)
  if (candidate.length === 0 || candidate.length > 254) return false
  return EMAIL_PATTERN.test(candidate)
}
