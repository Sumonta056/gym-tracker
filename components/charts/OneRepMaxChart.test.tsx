import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'
import { AXIS_TICKS, svgTexts, VALUE_LABELS } from '../../tests/fixtures/recharts'

import {
  buildSeries,
  drawnSeries,
  ONE_SESSION_HINT,
  oneRepMaxRows,
  OneRepMaxChart,
  PICK_LIMIT_HINT,
} from './OneRepMaxChart'

import type { LiftOption, SessionSlot } from './liftData'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const SLOTS: SessionSlot[] = [
  { id: 's1', date: '2026-09-02' },
  { id: 's2', date: '2026-09-03' },
  { id: 's3', date: '2026-09-06' },
]

const BENCH: LiftOption = {
  id: 'bench',
  name: 'Bench press',
  points: { s1: 50, s2: 53.33, s3: 56.25 },
}
const LAT: LiftOption = { id: 'lat', name: 'Lat pulldown', points: { s1: 44, s3: 49 } }
const LEG: LiftOption = { id: 'leg', name: 'Leg press', points: { s2: 106.67 } }
const ROW: LiftOption = { id: 'row', name: 'Seated row', points: { s3: 60 } }

describe('OneRepMaxChart', () => {
  it('shows its empty state before any session exists', () => {
    render(<OneRepMaxChart sessions={[]} options={[]} />)
    expect(screen.getByText('Finish a set with a load to see the one-rep max trend.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('shows the latest value and the hint for one session, with no lone dot', () => {
    render(
      <OneRepMaxChart sessions={SLOTS.slice(0, 1)} options={[{ ...BENCH, points: { s1: 50 } }]} />,
    )
    expect(screen.getByText(ONE_SESSION_HINT)).toBeVisible()
    expect(screen.getByText('50.0')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('draws a line for each of the first two exercises, with end labels and session labels', () => {
    const { container } = render(<OneRepMaxChart sessions={SLOTS} options={[BENCH, LAT, LEG]} />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['56.3', '49.0'])
    expect(svgTexts(container, AXIS_TICKS)).toEqual(['Wed 2', 'Thu 3', 'Sun 6'])
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(2)
    expect(container.querySelectorAll('.recharts-reference-line')).toHaveLength(0)
  })

  it('states each drawn trend in its label', () => {
    render(<OneRepMaxChart sessions={SLOTS} options={[BENCH, LAT]} />)
    expect(
      screen.getByRole('img', {
        name: 'Estimated one-rep max per session. Bench press rising from 50.0 to 56.3 kilograms. Lat pulldown rising from 44.0 to 49.0 kilograms.',
      }),
    ).toBeInTheDocument()
  })

  it('offers the exercises as a toggle group and presses the first two', () => {
    render(<OneRepMaxChart sessions={SLOTS} options={[BENCH, LAT, LEG]} />)
    expect(screen.getByRole('group', { name: 'Exercises on the chart, up to 3' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Bench press' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Leg press' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows a legend item only for a drawn line', async () => {
    const user = userEvent.setup()
    render(<OneRepMaxChart sessions={SLOTS} options={[BENCH, LAT, LEG]} />)
    await user.click(screen.getByRole('button', { name: 'Leg press' }))

    expect(screen.getByRole('button', { name: 'Leg press' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Bench press',
      'Lat pulldown',
    ])
  })

  it('keeps the colour of a line when another exercise is cleared', async () => {
    const user = userEvent.setup()
    const { container } = render(<OneRepMaxChart sessions={SLOTS} options={[BENCH, LAT, LEG]} />)
    await user.click(screen.getByRole('button', { name: 'Bench press' }))

    const strokes = Array.from(container.querySelectorAll('.recharts-line-curve')).map((path) =>
      path.getAttribute('stroke'),
    )
    expect(strokes).toEqual([colorTokens['data-cyan']])
  })

  it('names a picked exercise with one session under the chart', async () => {
    const user = userEvent.setup()
    render(<OneRepMaxChart sessions={SLOTS} options={[BENCH, LAT, LEG]} />)
    await user.click(screen.getByRole('button', { name: 'Leg press' }))

    expect(screen.getByText(`Leg press: one session, 106.7 kg. ${ONE_SESSION_HINT}`)).toBeVisible()
  })

  it('takes no fourth exercise while three are picked', async () => {
    const user = userEvent.setup()
    render(<OneRepMaxChart sessions={SLOTS} options={[BENCH, LAT, LEG, ROW]} />)
    await user.click(screen.getByRole('button', { name: 'Leg press' }))

    expect(screen.getByRole('button', { name: 'Seated row' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(PICK_LIMIT_HINT)
    expect(screen.getByRole('group')).toHaveAccessibleDescription(PICK_LIMIT_HINT)
  })

  it('asks for a pick when every exercise is cleared', async () => {
    const user = userEvent.setup()
    render(<OneRepMaxChart sessions={SLOTS} options={[BENCH, LAT]} />)
    await user.click(screen.getByRole('button', { name: 'Bench press' }))
    await user.click(screen.getByRole('button', { name: 'Lat pulldown' }))

    expect(screen.getByText('Pick an exercise to see its trend.')).toBeVisible()
    expect(screen.getByRole('group')).toBeVisible()
  })

  it('shows the values in pounds for the imperial setting', () => {
    const { container } = render(
      <OneRepMaxChart sessions={SLOTS} options={[LAT]} unit="imperial" />,
    )
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['108.0'])
  })

  it('gives every tap target 44 px', () => {
    render(<OneRepMaxChart sessions={SLOTS} options={[BENCH]} />)
    expect(screen.getByRole('button', { name: 'Bench press' })).toHaveClass('min-h-11')
  })
})

describe('oneRepMaxRows', () => {
  it('drops a session that only an undrawn line visits', () => {
    const { slots, series } = buildSeries(SLOTS, [LAT, LEG], ['lat', 'leg'], 'metric')
    expect(slots.map((slot) => slot.id)).toEqual(['s1', 's2', 's3'])
    expect(oneRepMaxRows(slots, drawnSeries(series)).map((row) => row.id)).toEqual(['s1', 's3'])
  })
})
