import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BENCH } from '../../tests/fixtures/lifts'

import {
  NO_RECORD,
  recordText,
  SessionSummary,
  summaryCells,
  SUMMARY_TITLE,
} from './SessionSummary'

import type { SessionStats } from '../../lib/metrics/sessionStats'

const STATS: SessionStats = {
  durationSeconds: 4325,
  setCount: 18,
  exerciseCount: 4,
  volumeKg: 3420,
  newRecords: [{ exerciseId: BENCH, weightKg: 102.5, reps: 3 }],
}

function renderSummary(stats: SessionStats | null = STATS, unit: 'metric' | 'imperial' = 'metric') {
  const onDone = vi.fn()
  render(<SessionSummary stats={stats} unit={unit} nameOf={() => 'Bench press'} onDone={onDone} />)
  return onDone
}

describe('summaryCells', () => {
  it('writes the sets, the exercises and the volume in kilograms', () => {
    expect(summaryCells(STATS, 'metric')).toEqual([
      { label: 'sets', value: '18' },
      { label: 'exercises', value: '4' },
      { label: 'volume (kg)', value: '3,420' },
    ])
  })

  it('writes the volume in pounds for imperial', () => {
    expect(summaryCells(STATS, 'imperial')[2]).toEqual({ label: 'volume (lb)', value: '7,540' })
  })
})

describe('recordText', () => {
  it('writes the weight in the display unit and the reps', () => {
    expect(recordText({ exerciseId: BENCH, weightKg: 102.5, reps: 3 }, 'metric')).toBe(
      '102.5 kg × 3',
    )
  })
})

describe('SessionSummary', () => {
  it('shows no sheet before a finish', () => {
    renderSummary(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the duration, the cells and the record', () => {
    renderSummary()
    const sheet = screen.getByRole('dialog', { name: SUMMARY_TITLE })
    expect(sheet).toHaveTextContent('1:12:05')
    expect(sheet).toHaveTextContent('sets18')
    expect(sheet).toHaveTextContent('Bench press102.5 kg × 3')
  })

  it('says so when the session set no record', () => {
    renderSummary({ ...STATS, newRecords: [] })
    expect(screen.getByText(NO_RECORD)).toBeVisible()
  })

  it('calls onDone once from the Done button', async () => {
    const onDone = renderSummary()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('is described by the duration, the cells and the records', () => {
    renderSummary()
    const sheet = screen.getByRole('dialog', { name: SUMMARY_TITLE })
    const id = sheet.getAttribute('aria-describedby') ?? ''
    expect(id).not.toBe('')
    expect(document.getElementById(id)).not.toContainElement(
      screen.getByRole('button', { name: 'Done' }),
    )
    expect(sheet).toHaveAccessibleDescription(
      /^Duration 1:12:05 sets 18 exercises 4 volume \(kg\) 3,420 New records Bench press.*102\.5 kg × 3$/,
    )
  })

  it('calls onDone once when Done is pressed twice', async () => {
    const onDone = renderSummary()
    const done = screen.getByRole('button', { name: 'Done' })
    await userEvent.click(done)
    await userEvent.click(done)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('calls onDone once when Done and then the close button are pressed', async () => {
    const onDone = renderSummary()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    await userEvent.click(screen.getByRole('button', { name: `Close ${SUMMARY_TITLE}` }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('calls onDone again for the sheet of a later finish', async () => {
    const onDone = vi.fn()
    const view = render(
      <SessionSummary stats={STATS} unit="metric" nameOf={() => 'Bench press'} onDone={onDone} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    view.rerender(
      <SessionSummary stats={null} unit="metric" nameOf={() => 'Bench press'} onDone={onDone} />,
    )
    view.rerender(
      <SessionSummary
        stats={{ ...STATS, setCount: 3 }}
        unit="metric"
        nameOf={() => 'Bench press'}
        onDone={onDone}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(2)
  })

  it('calls onDone from the close button', async () => {
    const onDone = renderSummary()
    await userEvent.click(screen.getByRole('button', { name: `Close ${SUMMARY_TITLE}` }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
