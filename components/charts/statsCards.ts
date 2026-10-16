export type StatsCardId =
  | 'weight'
  | 'calories'
  | 'steps'
  | 'walk'
  | 'heart-rate'
  | 'zone-split'
  | 'streak'
  | 'totals'
  | 'volume-load'
  | 'one-rep-max'
  | 'records'
  | 'muscle-balance'
  | 'session-gaps'
  | 'calories-per-minute'

export type StatsCardGroup = 'daily' | 'lift' | 'week'

export type StatsCardInfo = { name: string; group: StatsCardGroup; wide: boolean }

export const STATS_CARDS: Record<StatsCardId, StatsCardInfo> = {
  weight: { name: 'Weight', group: 'daily', wide: false },
  calories: { name: 'Calories burnt', group: 'daily', wide: false },
  steps: { name: 'Steps', group: 'daily', wide: false },
  walk: { name: 'Walk', group: 'daily', wide: false },
  'heart-rate': { name: 'Heart rate', group: 'daily', wide: false },
  'zone-split': { name: 'Heart rate zones', group: 'daily', wide: false },
  streak: { name: 'Streak', group: 'daily', wide: false },
  totals: { name: 'Totals', group: 'daily', wide: true },
  'volume-load': { name: 'Volume load', group: 'lift', wide: false },
  'one-rep-max': { name: 'One-rep max', group: 'lift', wide: false },
  records: { name: 'Personal records', group: 'lift', wide: true },
  'muscle-balance': { name: 'Muscle group balance', group: 'week', wide: false },
  'session-gaps': { name: 'Days between sessions', group: 'week', wide: false },
  'calories-per-minute': { name: 'Calories a gym minute', group: 'week', wide: true },
}

export const STATS_CARD_IDS: readonly StatsCardId[] = [
  'weight',
  'calories',
  'steps',
  'walk',
  'heart-rate',
  'zone-split',
  'streak',
  'totals',
  'volume-load',
  'one-rep-max',
  'records',
  'muscle-balance',
  'session-gaps',
  'calories-per-minute',
]

export type StatsLayoutItem = { id: StatsCardId; hidden: boolean }

export type StoredLayoutItem = { id: string; hidden: boolean }

export function isStatsCardId(id: string): id is StatsCardId {
  return Object.hasOwn(STATS_CARDS, id)
}

export function cardsInGroup(group: StatsCardGroup): StatsCardId[] {
  return STATS_CARD_IDS.filter((id) => STATS_CARDS[id].group === group)
}

export function resolveLayout(stored: readonly StoredLayoutItem[] | null): StatsLayoutItem[] {
  const result: StatsLayoutItem[] = []
  const placed = new Set<StatsCardId>()

  for (const item of stored ?? []) {
    if (isStatsCardId(item.id) && !placed.has(item.id)) {
      placed.add(item.id)
      result.push({ id: item.id, hidden: item.hidden })
    }
  }

  STATS_CARD_IDS.forEach((id, index) => {
    if (placed.has(id)) {
      return
    }

    const before = STATS_CARD_IDS.slice(0, index).findLast((earlier) => placed.has(earlier))
    const at = before === undefined ? 0 : result.findIndex((item) => item.id === before) + 1

    result.splice(at, 0, { id, hidden: false })
    placed.add(id)
  })

  return result
}

export function moveCard(
  layout: readonly StatsLayoutItem[],
  id: StatsCardId,
  by: -1 | 1,
): StatsLayoutItem[] {
  const from = layout.findIndex((item) => item.id === id)
  const to = from + by
  const moving = layout[from]
  const other = layout[to]

  if (moving === undefined || other === undefined) {
    return [...layout]
  }

  const next = [...layout]
  next[from] = other
  next[to] = moving

  return next
}

export function setHidden(
  layout: readonly StatsLayoutItem[],
  id: StatsCardId,
  hidden: boolean,
): StatsLayoutItem[] {
  return layout.map((item) => (item.id === id ? { ...item, hidden } : item))
}
