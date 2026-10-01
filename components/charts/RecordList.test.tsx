import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BENCH, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import { liftRecords } from './liftData'
import { NEW_TODAY, RecordList, recordDetail, shortDate } from './RecordList'

import type { LiftRecord } from './liftData'

const session = sessionOn('2026-09-12')
const benchRecords = liftRecords(
  [
    liftSet(session, BENCH, 10, 40),
    liftSet(session, BENCH, 8, 45),
    liftSet(session, BENCH, 10, 42.5),
  ],
  new Map([[BENCH, 'Bench press']]),
)

const LAT: LiftRecord = {
  exerciseId: 'lat',
  name: 'Lat pulldown',
  loadKg: 35,
  reps: 12,
  at: '2026-09-23T12:00:00.000Z',
  volumeKg: 1200,
  oneRepMaxKg: 49,
}

describe('RecordList', () => {
  it('shows its empty state before any session exists', () => {
    render(<RecordList records={[]} today="2026-09-23" />)
    expect(screen.getByText('Finish a set with a load to see your records.')).toBeVisible()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('matches a hand calculation for one exercise', () => {
    render(<RecordList records={benchRecords} today="2026-09-23" />)
    const row = screen.getByRole('listitem')

    expect(within(row).getByText('Bench press')).toBeVisible()
    expect(within(row).getByText('est. 1RM 57.0 kg · best volume 425 kg')).toBeVisible()
    expect(within(row).getByText('45 × 8')).toBeVisible()
    expect(within(row).getByText('Best load 45 kg for 8 reps')).toBeInTheDocument()
    expect(within(row).getByText('12 Sep')).toBeVisible()
  })

  it('marks a record set today as new', () => {
    render(<RecordList records={[LAT]} today="2026-09-23" />)
    expect(screen.getByText(NEW_TODAY)).toBeVisible()
    expect(screen.queryByText('23 Sep')).not.toBeInTheDocument()
  })

  it('names the card as a heading', () => {
    render(<RecordList records={[LAT]} today="2026-09-23" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Personal records' })).toBeVisible()
  })

  it('writes a pound load to one decimal, with no trailing .0', () => {
    render(<RecordList records={[{ ...LAT, loadKg: 47.5 }]} today="2026-09-30" unit="imperial" />)
    expect(screen.getByText('104.7 × 12')).toBeVisible()
  })

  it('shows the loads in pounds for the imperial setting', () => {
    render(<RecordList records={[LAT]} today="2026-09-30" unit="imperial" />)
    expect(screen.getByText('77.2 × 12')).toBeVisible()
    expect(screen.getByText('est. 1RM 108.0 lb · best volume 2,646 lb')).toBeVisible()
  })
})

describe('recordDetail', () => {
  it('leaves out the one-rep max when there is none', () => {
    expect(recordDetail({ ...LAT, oneRepMaxKg: null, volumeKg: 0 }, 'metric')).toBe(
      'best volume 0 kg',
    )
  })
})

describe('shortDate', () => {
  it('writes the day and the short month', () => {
    expect(shortDate('2026-09-08')).toBe('8 Sep')
  })
})
