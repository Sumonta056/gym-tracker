const MS_PER_DAY = 86400000

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

export function toDayNumber(date: string): number | null {
  if (!ISO_DATE.test(date)) {
    return null
  }

  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const number = Date.UTC(year, month - 1, day) / MS_PER_DAY

  return fromDayNumber(number) === date ? number : null
}

export function localDayNumber(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY
}
