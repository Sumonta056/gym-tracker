import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'
import {
  AXIS_TICKS,
  barFills,
  REFERENCE_LABELS,
  svgTexts,
  VALUE_LABELS,
} from '../../tests/fixtures/recharts'

import {
  clearOfLine,
  tickPlace,
  volumeLabel,
  volumePlacement,
  volumeRows,
  VolumeLoadChart,
  weekChangeText,
} from './VolumeLoadChart'

import type { SessionVolume } from '../../lib/metrics/liftTrends'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

function volume(date: string, kg: number): SessionVolume {
  return { sessionId: `session-${date}`, date, volume: kg }
}

const full = [
  volume('2026-09-02', 3240),
  volume('2026-09-03', 4410),
  volume('2026-09-06', 3910),
  volume('2026-09-09', 5180),
  volume('2026-09-12', 4670),
  volume('2026-09-13', 5940),
]

describe('VolumeLoadChart', () => {
  it('shows its empty state before any session exists', () => {
    render(<VolumeLoadChart volumes={[]} weekChange={null} tab="week" />)
    expect(
      screen.getByText('Finish a set with a load to see the volume of each session.'),
    ).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText(/last week/)).not.toBeInTheDocument()
  })

  it('shows its empty state when no session holds a load', () => {
    render(<VolumeLoadChart volumes={[volume('2026-09-02', 0)]} weekChange={null} tab="week" />)
    expect(
      screen.getByText('Finish a set with a load to see the volume of each session.'),
    ).toBeVisible()
  })

  it('draws one labelled bar with no average line for one session', () => {
    const { container } = render(
      <VolumeLoadChart volumes={[volume('2026-09-02', 3240)]} weekChange={null} tab="week" />,
    )
    expect(
      screen.getByRole('img', {
        name: 'Volume load per session, one session: 3,240 kilograms. No volume last week to compare.',
      }),
    ).toBeInTheDocument()
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['3.2k'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual([])
    expect(svgTexts(container, AXIS_TICKS)).toEqual(['Wed 2'])
    expect(screen.getByText('3,240 kg')).toBeVisible()
    expect(screen.getByText('No volume last week to compare')).toBeVisible()
  })

  it('labels every bar clear of the average line, the sessions and the average on the week range', () => {
    const { container } = render(<VolumeLoadChart volumes={full} weekChange={18} tab="week" />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['5.2k', '4.7k', '5.9k'])
    expect(svgTexts(container, AXIS_TICKS)).toEqual([
      'Wed 2',
      'Thu 3',
      'Sun 6',
      'Wed 9',
      'Sat 12',
      'Sun 13',
    ])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['avg 4.6k'])
    expect(screen.getByText('avg 4,558 kg')).toBeVisible()
    expect(screen.getByText('+18% vs last week')).toBeVisible()
  })

  it('labels the highest bar only on the month range', () => {
    const { container } = render(<VolumeLoadChart volumes={full} weekChange={18} tab="month" />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['5.9k'])
  })

  it('states the trend, the average and the week change in its label', () => {
    render(<VolumeLoadChart volumes={full} weekChange={18} tab="week" />)
    expect(
      screen.getByRole('img', {
        name: 'Volume load per session, rising: 3,240, 4,410, 3,910, 5,180, 4,670, 5,940 kilograms. Average 4,558 kilograms a session. Up 18 percent against last week.',
      }),
    ).toBeInTheDocument()
  })

  it('shows the volume in pounds for the imperial setting', () => {
    const { container } = render(
      <VolumeLoadChart
        volumes={[volume('2026-09-02', 1000)]}
        weekChange={null}
        tab="week"
        unit="imperial"
      />,
    )
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['2.2k'])
    expect(screen.getByText('2,205 lb')).toBeVisible()
    expect(screen.getByText('lb lifted, reps × load')).toBeVisible()
  })

  it('fills a session with no load as a ghost slot', () => {
    const { container } = render(
      <VolumeLoadChart
        volumes={[volume('2026-09-02', 3240), volume('2026-09-03', 0)]}
        weekChange={null}
        tab="week"
      />,
    )
    expect(barFills(container)).toContain(colorTokens['surface-2'])
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['3.2k'])
  })
})

describe('weekChangeText', () => {
  it('writes a fall with a minus sign', () => {
    expect(weekChangeText(-20)).toBe('−20% vs last week')
  })

  it('writes no change as the same', () => {
    expect(weekChangeText(0)).toBe('Same as last week')
  })
})

describe('volumeLabel', () => {
  it('states a fall and the same week in words', () => {
    expect(volumeLabel([5000, 4000], 4500, -20)).toBe(
      'Volume load per session, falling: 5,000, 4,000 kilograms. Average 4,500 kilograms a session. Down 20 percent against last week.',
    )
    expect(volumeLabel([5000, 5000], 5000, 0)).toContain('The same as last week.')
  })
})

describe('volumeRows', () => {
  it('gives every session a row keyed by its id', () => {
    expect(volumeRows([volume('2026-09-02', 500)], 'week', 'metric', 500)).toEqual([
      { id: 'session-2026-09-02', value: 500, ghost: null, label: '500' },
    ])
  })
})

describe('volumePlacement', () => {
  const row = (value: number) => ({ id: String(value), value, ghost: null, label: 'x' })

  it('moves the average label to its own row where below the line would touch a value label', () => {
    expect(volumePlacement([row(3100), row(2325), row(2220)], 3100, 2548, 112, 'week')).toBe('band')
  })

  it('keeps the average label above the line when the right end sits well below it', () => {
    expect(volumePlacement([row(3100), row(500), row(400)], 3100, 2000, 112, 'week')).toBe('above')
  })

  it('always puts the month average label in its own row', () => {
    expect(volumePlacement([row(3100), row(500), row(400)], 3100, 2000, 112, 'month')).toBe('band')
  })
})

describe('tickPlace', () => {
  it('centres a label that fits', () => {
    expect(tickPlace(100, 300, 'Wed 2')).toEqual({ x: 100, anchor: 'middle' })
  })

  it('starts a label at the left edge when centring would cut it', () => {
    expect(tickPlace(10, 300, 'Wed 2')).toEqual({ x: 0, anchor: 'start' })
  })

  it('ends a label at the right edge when centring would cut it', () => {
    expect(tickPlace(295, 300, 'Sun 20')).toEqual({ x: 300, anchor: 'end' })
  })
})

describe('clearOfLine', () => {
  const row = (value: number) => ({ id: String(value), value, ghost: null, label: String(value) })

  it('drops a value label that the average line would cross', () => {
    const rows = [row(6800), row(5100), row(4900)]
    expect(clearOfLine(rows, 5600, 6800, 112, 32).map((item) => item.label)).toEqual([
      '6800',
      null,
      null,
    ])
  })

  it('drops a value label that sits just above a line through its bar top', () => {
    const rows = [row(2900), row(2900)]
    expect(clearOfLine(rows, 2900, 2900, 112, 18).map((item) => item.label)).toEqual([null, null])
  })

  it('keeps a value label well clear of the line', () => {
    const rows = [row(3100), row(500), row(400)]
    expect(clearOfLine(rows, 1333, 3100, 112, 18).map((item) => item.label)).toEqual([
      '3100',
      '500',
      '400',
    ])
  })

  it('keeps a row with no label as it is', () => {
    const ghost = { id: 'g', value: null, ghost: 100, label: null }
    expect(clearOfLine([ghost], 50, 100, 112, 18)).toEqual([ghost])
  })
})

describe('VolumeLoadChart, the average line', () => {
  it('writes no value label where the average line would cross it', () => {
    const { container } = render(
      <VolumeLoadChart
        volumes={[
          volume('2026-09-15', 3100),
          volume('2026-09-17', 2325),
          volume('2026-09-20', 2220),
        ]}
        weekChange={5}
        tab="week"
      />,
    )
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['3.1k'])
    expect(
      screen.getByRole('img', {
        name: 'Volume load per session, falling: 3,100, 2,325, 2,220 kilograms. Average 2,548 kilograms a session. Up 5 percent against last week.',
      }),
    ).toBeInTheDocument()
  })
})
