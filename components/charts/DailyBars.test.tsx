import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'
import { compactNumber } from '../../lib/format/compactNumber'
import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import {
  AXIS_TICKS,
  barFills,
  REFERENCE_LABELS,
  svgTexts,
  VALUE_LABELS,
} from '../../tests/fixtures/recharts'

import { barRadius, barRows, chartTop, DailyBars, drawnValue, ReferenceLabel } from './DailyBars'
import { analyse } from './rangeData'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const week = analyse(
  [entryOn('2026-09-21', { steps: 9120 }), entryOn(TODAY, { steps: 12480 })],
  [],
  'week',
  TODAY,
  NOW,
  12000,
)

function bars(tab: 'day' | 'week' | 'month', entries = [entryOn(TODAY, { steps: 985 })]) {
  const data = analyse(entries, [], tab, TODAY, NOW, 12000)
  return render(
    <DailyBars
      days={data.days}
      dataKey="steps"
      color={colorTokens['data-cyan']}
      tab={tab}
      formatValue={compactNumber}
    />,
  ).container
}

describe('DailyBars', () => {
  it('renders only ghost slots for an empty series, without throwing', () => {
    const empty = analyse([], [], 'week', TODAY, NOW, 12000)
    const { container } = render(
      <DailyBars
        days={empty.days}
        dataKey="steps"
        color={colorTokens['data-cyan']}
        tab="week"
        formatValue={compactNumber}
      />,
    )
    expect(barFills(container)).toEqual(Array(7).fill(colorTokens['surface-2']))
    expect(svgTexts(container, VALUE_LABELS)).toEqual([])
  })

  it('draws one bar and six ghost slots for one logged day in a week', () => {
    const fills = barFills(bars('week'))
    expect(fills.filter((fill) => fill === colorTokens['data-cyan'])).toHaveLength(1)
    expect(fills.filter((fill) => fill === colorTokens['surface-2'])).toHaveLength(6)
  })

  it('labels the week days M T W T F S S under the bars', () => {
    expect(svgTexts(bars('week'), AXIS_TICKS)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('labels the month on the 1st, 8th, 15th, 22nd and 29th', () => {
    expect(svgTexts(bars('month'), AXIS_TICKS)).toEqual(['1', '8', '15', '22', '29'])
  })

  it('labels a single day by its weekday and date', () => {
    expect(svgTexts(bars('day'), AXIS_TICKS)).toEqual(['Wed 23'])
  })

  it('writes a compact value above every bar on the week', () => {
    const { container } = render(
      <DailyBars
        days={week.days}
        dataKey="steps"
        color={colorTokens['data-cyan']}
        tab="week"
        formatValue={compactNumber}
      />,
    )
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['9.1k', '12.5k'])
  })

  it('writes a value above only the highest bar on the month', () => {
    const container = bars('month', [
      entryOn('2026-09-02', { steps: 4000 }),
      entryOn('2026-09-10', { steps: 13100 }),
      entryOn(TODAY, { steps: 9904 }),
    ])
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['13.1k'])
  })

  it('draws a labelled reference line when one is given', () => {
    const { container } = render(
      <DailyBars
        days={week.days}
        dataKey="steps"
        color={colorTokens['data-cyan']}
        tab="week"
        formatValue={compactNumber}
        reference={{ value: 12000, label: 'goal 12k' }}
      />,
    )
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 12k'])
  })

  it('draws a ghost slot and no label for a logged day of zero', () => {
    const container = bars('week', [entryOn(TODAY, { steps: 0 })])
    expect(barFills(container)).toEqual(Array(7).fill(colorTokens['surface-2']))
    expect(svgTexts(container, VALUE_LABELS)).toEqual([])
  })

  it('draws no reference line when none is given', () => {
    expect(svgTexts(bars('week'), REFERENCE_LABELS)).toEqual([])
  })
})

describe('barRows', () => {
  it('fills a ghost slot to the top of the scale only on a day with no value', () => {
    const rows = barRows(week.days, 'steps', 'week', compactNumber, 13000)
    expect(rows[0]).toMatchObject({ value: 9120, ghost: null, label: '9.1k' })
    expect(rows[1]).toMatchObject({ value: null, ghost: 13000, label: null })
  })
})

describe('drawnValue', () => {
  it('treats zero as no value, so a zero day gets a ghost slot and no label', () => {
    expect(drawnValue(0)).toBeNull()
    expect(drawnValue(null)).toBeNull()
    expect(drawnValue(5)).toBe(5)
  })
})

describe('ReferenceLabel', () => {
  it('ends the label at the right edge of the gutter, so a longer label grows to the left', () => {
    const { container } = render(
      <svg>
        <ReferenceLabel viewBox={{ x: 0, y: 30, width: 262 }} text="goal 12.5k" />
      </svg>,
    )
    const text = container.querySelector('.reference-label')
    expect(text).toHaveAttribute('text-anchor', 'end')
    expect(text).toHaveAttribute('x', '320')
    expect(text).toHaveTextContent('goal 12.5k')
  })

  it('draws at the origin when no view box is given', () => {
    const { container } = render(
      <svg>
        <ReferenceLabel text="avg 5" />
      </svg>,
    )
    expect(container.querySelector('.reference-label')).toHaveAttribute('y', '0')
  })
})

describe('chartTop', () => {
  it('lifts the scale to a reference line above every bar', () => {
    expect(chartTop(week.days, 'steps', { value: 15000, label: 'goal 15k' })).toBe(15000)
  })

  it('never returns a zero scale', () => {
    expect(chartTop(analyse([], [], 'week', TODAY, NOW, 0).days, 'steps')).toBe(1)
  })
})

describe('barRadius', () => {
  it('rounds a week of bars by 6 px', () => {
    expect(barRadius(7)).toBe(6)
  })

  it('rounds a month of thinner bars by 3 px', () => {
    expect(barRadius(30)).toBe(3)
  })
})
