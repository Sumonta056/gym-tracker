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

import {
  aboveLabelBox,
  barRadius,
  barRows,
  chartTop,
  DailyBars,
  drawnValue,
  goalOrAverage,
  ReferenceLabel,
  referencePlacement,
  valueLabelBox,
} from './DailyBars'
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

  it('labels the week days Mon to Sun under the bars', () => {
    expect(svgTexts(bars('week'), AXIS_TICKS)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ])
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
  it('ends the label at the right edge of the plot, inside it, so the chart needs no gutter', () => {
    const { container } = render(
      <svg>
        <ReferenceLabel viewBox={{ x: 0, y: 30, width: 262 }} text="goal 12.5k" />
      </svg>,
    )
    const text = container.querySelector('.reference-label')
    expect(text).toHaveAttribute('text-anchor', 'end')
    expect(text).toHaveAttribute('x', '262')
    expect(text).toHaveTextContent('goal 12.5k')
  })

  it('sits just above its line by default', () => {
    const { container } = render(
      <svg>
        <ReferenceLabel viewBox={{ x: 0, y: 30, width: 262 }} text="goal 12k" />
      </svg>,
    )
    const text = container.querySelector('.reference-label')
    expect(text).toHaveAttribute('y', '27')
    expect(text).not.toHaveAttribute('dy')
  })

  it('sits in the row above the plot when placed in the band', () => {
    const { container } = render(
      <svg>
        <ReferenceLabel viewBox={{ x: 0, y: 60, width: 262 }} text="avg 706" placement="band" />
      </svg>,
    )
    const text = container.querySelector('.reference-label')
    expect(text).toHaveAttribute('y', '11')
    expect(text).toHaveAttribute('x', '262')
  })

  it('hangs just below its line when placed below', () => {
    const { container } = render(
      <svg>
        <ReferenceLabel viewBox={{ x: 0, y: 30, width: 262 }} text="goal 12k" placement="below" />
      </svg>,
    )
    const text = container.querySelector('.reference-label')
    expect(text).toHaveAttribute('y', '33')
    expect(text).toHaveAttribute('dy', '0.8em')
  })

  it('carries the label halo, so it reads over a bar', () => {
    const { container } = render(
      <svg>
        <ReferenceLabel viewBox={{ x: 0, y: 30, width: 262 }} text="avg 706" />
      </svg>,
    )
    const text = container.querySelector('.reference-label')
    expect(text).toHaveAttribute('stroke', colorTokens.surface)
    expect(text).toHaveAttribute('paint-order', 'stroke')
  })

  it('draws at the origin when no view box is given', () => {
    const { container } = render(
      <svg>
        <ReferenceLabel text="avg 5" />
      </svg>,
    )
    expect(container.querySelector('.reference-label')).toHaveAttribute('x', '0')
  })
})

describe('referencePlacement', () => {
  const label = (value: number | null) => ({ value, label: value === null ? null : 'x' })

  it('goes above the line when the bars at the right end sit well below it', () => {
    const rows = [
      label(12000),
      label(4000),
      label(4000),
      label(4000),
      label(4000),
      label(3000),
      label(3000),
    ]
    expect(referencePlacement(rows, 12000, 12000, 112)).toBe('above')
  })

  it('takes the band when a bar at the right end crosses the line', () => {
    const rows = [
      label(16000),
      label(9000),
      label(9000),
      label(9000),
      label(4000),
      label(4000),
      label(13000),
    ]
    expect(referencePlacement(rows, 16000, 12000, 112)).toBe('band')
  })

  it('takes the band when every bar crosses the goal line, as 72m bars under a 45m goal', () => {
    const rows = [4325, 4325, null, 4325, 4325, 4325, 4325].map(label)
    expect(referencePlacement(rows, 4325, 2700, 112)).toBe('band')
  })

  it('takes the band when a bar with no value label crosses the line, on a month', () => {
    const rows = [label(16000), label(4000), label(4000), { value: 13000, label: null }]
    expect(referencePlacement(rows, 16000, 12000, 112)).toBe('band')
  })

  it('goes above a line that runs over an empty slot', () => {
    const rows = [label(16000), label(4000), label(4000), label(null)]
    expect(referencePlacement(rows, 16000, 12000, 112)).toBe('above')
  })

  it('takes its own row at the top when a value label sits on each side of the line', () => {
    const rows = [
      label(13100),
      label(11400),
      label(6900),
      label(12480),
      label(8300),
      label(13100),
      label(9904),
    ]
    expect(referencePlacement(rows, 13100, 12000, 112)).toBe('band')
  })

  it('takes its own row at the top when below would run into the day labels', () => {
    const rows = [
      label(10000),
      label(9000),
      label(9000),
      label(9000),
      label(9000),
      label(9000),
      label(1500),
    ]
    expect(referencePlacement(rows, 10000, 1000, 112)).toBe('band')
  })

  it('ignores a bar with no value label, as a month bar that is not the highest', () => {
    const rows = [
      label(16000),
      label(9000),
      label(9000),
      label(9000),
      label(4000),
      label(4000),
      { value: 11000, label: null },
    ]
    expect(referencePlacement(rows, 16000, 12000, 112)).toBe('above')
  })

  it('goes above for an empty chart', () => {
    expect(referencePlacement([], 1, 1, 112)).toBe('above')
  })

  it('takes the band when the value label just under the line reaches the label below it', () => {
    const rows = [620, 780, 410, 985, 540, 900, 705].map(label)
    expect(referencePlacement(rows, 985, 800, 112)).toBe('band')
  })

  it('takes the band when a goal line runs just over the value labels', () => {
    const rows = Array.from({ length: 7 }, () => label(3324))
    expect(referencePlacement(rows, 3600, 3600, 112)).toBe('band')
  })
})

describe('label boxes, measured in the browser', () => {
  function covers(model: { top: number; bottom: number }, measured: [number, number]): boolean {
    const [top, bottom] = measured
    return (
      model.top <= top && model.bottom >= bottom && top - model.top < 1 && model.bottom - bottom < 1
    )
  }

  it('covers a value label above a bar top at 38.47 px, measured at 23.00 to 36.20', () => {
    expect(covers(valueLabelBox(38.47), [23.0, 36.2])).toBe(true)
  })

  it('covers a value label above a bar top at 23.52 px, measured at 8.10 to 21.30', () => {
    expect(covers(valueLabelBox(23.52), [8.1, 21.3])).toBe(true)
  })

  it('covers a label above a line at 45.05 px, measured at 31.59 to 44.81', () => {
    expect(covers(aboveLabelBox(45.05), [31.59, 44.81])).toBe(true)
  })
})

describe('DailyBars, reference band', () => {
  it('lowers the plot by one label row when the label takes the band', () => {
    const steps = [9120, 11400, 6900, 12480, 8300, 13100, 9904]
    const data = analyse(
      steps.map((value, index) => entryOn(`2026-09-${String(21 + index)}`, { steps: value })),
      [],
      'week',
      TODAY,
      NOW,
      12000,
    )
    const { container } = render(
      <DailyBars
        days={data.days}
        dataKey="steps"
        color={colorTokens['data-cyan']}
        tab="week"
        formatValue={compactNumber}
        reference={{ value: 12000, label: 'goal 12k' }}
      />,
    )
    const tops = Array.from(container.querySelectorAll('.recharts-bar-rectangle path')).map(
      (path) => Number(path.getAttribute('y')),
    )
    expect(Math.min(...tops)).toBe(32)
    expect(container.querySelector('.reference-label')).toHaveAttribute('y', '11')
  })

  it('lowers the plot when a bar at the right end crosses the average line', () => {
    const calories = [620, 780, 410, 985, 540, 900, 705]
    const data = analyse(
      calories.map((value, index) =>
        entryOn(`2026-09-${String(21 + index)}`, { calories_burnt: value }),
      ),
      [],
      'week',
      TODAY,
      NOW,
      12000,
    )
    const { container } = render(
      <DailyBars
        days={data.days}
        dataKey="calories"
        color={colorTokens.warn}
        tab="week"
        formatValue={compactNumber}
        reference={{ value: 706, label: 'avg 706' }}
      />,
    )
    const tops = Array.from(container.querySelectorAll('.recharts-bar-rectangle path')).map(
      (path) => Number(path.getAttribute('y')),
    )
    expect(Math.min(...tops)).toBe(32)
    expect(container.querySelector('.reference-label')).toHaveAttribute('y', '11')
  })
})

describe('DailyBars, reference gutter', () => {
  it('leaves no right gutter for the reference label', () => {
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
    const line = container.querySelector('.recharts-reference-line-line')
    const surface = container.querySelector('svg.recharts-surface')
    expect(Number(line?.getAttribute('x2'))).toBe(Number(surface?.getAttribute('width')))
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

describe('goalOrAverage', () => {
  const format = (value: number) => String(Math.round(value))

  it('takes the goal when the profile holds one', () => {
    expect(goalOrAverage(800, 603, format)).toEqual({ value: 800, label: 'goal 800' })
  })

  it('takes the average when there is no goal', () => {
    expect(goalOrAverage(null, 603, format)).toEqual({ value: 603, label: 'avg 603' })
  })

  it('draws no line with no goal and no average', () => {
    expect(goalOrAverage(null, null, format)).toBeNull()
  })

  it('draws no line for an average of 0', () => {
    expect(goalOrAverage(null, 0, format)).toBeNull()
  })
})
