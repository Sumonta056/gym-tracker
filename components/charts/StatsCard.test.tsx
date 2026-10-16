import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import { REFERENCE_LABELS, svgTexts } from '../../tests/fixtures/recharts'

import { analyseLifts } from './liftData'
import { analyse, NO_GOALS } from './rangeData'
import { DAY_CARD_IDS, StatsCard } from './StatsCard'
import { STATS_CARD_IDS, STATS_CARDS } from './statsCards'

import type { StatsCardContext } from './StatsCard'
import type { LiftSource } from './useLiftData'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const ENTRIES = [
  entryOn('2026-09-21', { walk_seconds: 1800 }),
  entryOn('2026-09-22', { walk_seconds: 2700 }),
  entryOn(TODAY, { walk_seconds: 3600 }),
]

const DATA = analyse(
  ENTRIES,
  ENTRIES,
  'week',
  TODAY,
  NOW,
  12000,
  'metric',
  [],
  { ...NO_GOALS, walkSeconds: 3600 },
  { bpm: 190, source: 'override' },
)

const SOURCE: LiftSource = { sessions: [], sets: [], exercises: [] }

const FULL: StatsCardContext = {
  daily: DATA,
  lifts: {
    analysis: analyseLifts([], [], [], 'week', TODAY),
    unit: 'metric',
    tab: 'week',
    today: TODAY,
  },
  week: { source: SOURCE, days: DATA.days, today: TODAY, sessionDates: [] },
}

const EMPTY: StatsCardContext = { daily: null, lifts: null, week: null }

describe('StatsCard', () => {
  it.each(STATS_CARD_IDS)('renders the %s card with a level 2 heading', (id) => {
    render(<StatsCard id={id} context={FULL} />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
  })

  it.each(STATS_CARD_IDS)('renders nothing for %s when its group input is null', (id) => {
    const { container } = render(<StatsCard id={id} context={EMPTY} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a lift card and a week card with nothing when only the daily input is set', () => {
    const { container } = render(
      <>
        <StatsCard id="records" context={{ ...EMPTY, daily: DATA }} />
        <StatsCard id="session-gaps" context={{ ...EMPTY, daily: DATA }} />
      </>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it.each(STATS_CARD_IDS)('spans 2 columns from md only when %s is wide', (id) => {
    const { container } = render(<StatsCard id={id} context={FULL} />)
    const card = container.firstElementChild
    expect(card?.classList.contains('md:col-span-2')).toBe(STATS_CARDS[id].wide)
  })

  it('makes totals, records and the calorie rate the wide cards', () => {
    expect(STATS_CARD_IDS.filter((id) => STATS_CARDS[id].wide)).toEqual([
      'totals',
      'records',
      'calories-per-minute',
    ])
  })

  it('draws the walk goal line', () => {
    const { container } = render(<StatsCard id="walk" context={FULL} />)
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 60m'])
  })

  it('carries the zone info button on the zone split card', () => {
    render(<StatsCard id="zone-split" context={FULL} />)
    expect(screen.getByRole('button', { name: 'What the zones mean' })).toBeInTheDocument()
  })
})

const DAY = analyse(
  ENTRIES.filter((row) => row.entry_date === TODAY),
  ENTRIES,
  'day',
  TODAY,
  NOW,
  12000,
  'metric',
  [],
  { ...NO_GOALS, walkSeconds: 3600 },
  { bpm: 190, source: 'override' },
)

describe('StatsCard on the day tab', () => {
  it.each([...DAY_CARD_IDS])('renders the %s day card in place of the chart', (id) => {
    render(<StatsCard id={id} context={{ ...EMPTY, daily: DAY }} />)
    expect(screen.getByTestId('day-card')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('keeps the chart for a card with no day card', () => {
    render(<StatsCard id="totals" context={{ ...EMPTY, daily: DAY }} />)
    expect(screen.queryByTestId('day-card')).toBeNull()
  })

  it('keeps the charts on the week tab', () => {
    render(<StatsCard id="steps" context={FULL} />)
    expect(screen.queryByTestId('day-card')).toBeNull()
  })

  it('reads the 7 recent days and the walk goal on the day tab', () => {
    render(<StatsCard id="walk" context={{ ...EMPTY, daily: DAY }} />)
    expect(screen.getByText('Mon 21: 30m')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('keeps a narrow day card to 1 column', () => {
    render(<StatsCard id="steps" context={{ ...EMPTY, daily: DAY }} />)
    expect(screen.getByTestId('day-card')).not.toHaveClass('md:col-span-2')
  })
})
