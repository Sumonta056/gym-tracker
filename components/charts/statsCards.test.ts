import { describe, expect, it } from 'vitest'

import { moveCard, resolveLayout, setHidden, STATS_CARD_IDS } from './statsCards'

import type { StatsLayoutItem } from './statsCards'

const DEFAULT = STATS_CARD_IDS.map((id) => ({ id, hidden: false }))

function ids(layout: readonly StatsLayoutItem[]): string[] {
  return layout.map((item) => item.id)
}

describe('resolveLayout', () => {
  it('returns every card in the default order when nothing is stored', () => {
    expect(resolveLayout(null)).toEqual(DEFAULT)
  })

  it('keeps the stored order and the hidden flags', () => {
    const stored = [...DEFAULT].reverse().map((item, index) => ({ ...item, hidden: index === 0 }))
    expect(resolveLayout(stored)).toEqual(stored)
  })

  it('drops an id this build does not know', () => {
    expect(ids(resolveLayout([{ id: 'sleep', hidden: false }, ...DEFAULT]))).toEqual(STATS_CARD_IDS)
  })

  it('keeps the first of 2 rows with the same id', () => {
    const stored = [{ id: 'steps', hidden: true }, ...DEFAULT]
    const layout = resolveLayout(stored)
    expect(layout).toHaveLength(STATS_CARD_IDS.length)
    expect(layout[0]).toEqual({ id: 'steps', hidden: true })
  })

  it('adds a card that an older layout lacks at its default place, shown', () => {
    const older = DEFAULT.filter((item) => item.id !== 'records').map((item) =>
      item.id === 'weight' ? { ...item, hidden: true } : item,
    )
    const layout = resolveLayout(older)
    expect(ids(layout)).toEqual(STATS_CARD_IDS)
    expect(layout.find((item) => item.id === 'records')).toEqual({ id: 'records', hidden: false })
    expect(layout[0]).toEqual({ id: 'weight', hidden: true })
  })

  it('puts a missing card right after the card before it in the default order', () => {
    const stored = [
      { id: 'steps', hidden: false },
      { id: 'weight', hidden: false },
    ]
    const order = ids(resolveLayout(stored))
    expect(order.indexOf('calories')).toBe(order.indexOf('weight') + 1)
    expect(order.indexOf('walk')).toBe(order.indexOf('steps') + 1)
    expect(order).toHaveLength(STATS_CARD_IDS.length)
  })

  it('puts a missing first card first', () => {
    const stored = DEFAULT.filter((item) => item.id !== 'weight')
    expect(resolveLayout(stored)[0]).toEqual({ id: 'weight', hidden: false })
  })
})

describe('moveCard', () => {
  it('swaps a card with the card above it', () => {
    expect(ids(moveCard(DEFAULT, 'steps', -1)).slice(0, 3)).toEqual(['weight', 'steps', 'calories'])
  })

  it('swaps a card with the card below it', () => {
    expect(ids(moveCard(DEFAULT, 'weight', 1)).slice(0, 2)).toEqual(['calories', 'weight'])
  })

  it('leaves the order alone when the first card moves up', () => {
    expect(moveCard(DEFAULT, 'weight', -1)).toEqual(DEFAULT)
  })

  it('leaves the order alone when the last card moves down', () => {
    expect(moveCard(DEFAULT, 'calories-per-minute', 1)).toEqual(DEFAULT)
  })

  it('leaves the order alone for an id that is not in the layout', () => {
    const short = DEFAULT.slice(0, 2)
    expect(moveCard(short, 'records', -1)).toEqual(short)
  })

  it('never changes the layout it was given', () => {
    const before = structuredClone(DEFAULT)
    moveCard(DEFAULT, 'steps', -1)
    expect(DEFAULT).toEqual(before)
  })
})

describe('setHidden', () => {
  it('hides only the named card', () => {
    const layout = setHidden(DEFAULT, 'steps', true)
    expect(layout.filter((item) => item.hidden)).toEqual([{ id: 'steps', hidden: true }])
  })
})
