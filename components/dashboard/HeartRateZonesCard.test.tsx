import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HeartRateZonesCard, zoneSummary } from './HeartRateZonesCard'

const ZONES = {
  warmSeconds: 480,
  fatBurnSeconds: 2280,
  cardioSeconds: 1260,
  peakSeconds: 300,
}

const NONE = { warmSeconds: 0, fatBurnSeconds: 0, cardioSeconds: 0, peakSeconds: 0 }

describe('HeartRateZonesCard', () => {
  it('gives the bar a text alternative with every zone', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(
      screen.getByRole('img', {
        name: 'Heart rate zones: Warm 8m, Fat burn 38m, Cardio 21m, Peak 5m',
      }),
    ).toBeInTheDocument()
  })

  it('prints the same numbers outside the bar', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    for (const text of ['Warm 8m', 'Fat burn 38m', 'Cardio 21m', 'Peak 5m']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })

  it('names the cardio time in the header', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(screen.getByText('21m in cardio')).toBeInTheDocument()
  })

  it('draws four segments when every zone has time', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(screen.getByRole('img').children).toHaveLength(4)
  })

  it('leaves out a zone with no time from the bar', () => {
    render(<HeartRateZonesCard zones={{ ...ZONES, peakSeconds: 0 }} maxHeartRate={null} />)
    expect(screen.getByRole('img').children).toHaveLength(3)
  })

  it('explains what to log when there is no zone time', () => {
    render(<HeartRateZonesCard zones={NONE} maxHeartRate={null} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/Log gym time/)).toBeInTheDocument()
  })

  it('asks for the birth year when the max is not known', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(screen.getByText('Add your birth year in Profile for real zones.')).toBeInTheDocument()
  })

  it('names the max and its source when the max is known', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={{ bpm: 190, source: 'age' }} />)
    expect(screen.getByText('Based on a max of 190 bpm, from your birth year.')).toBeInTheDocument()
  })

  it('names an override as set in Profile', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={{ bpm: 175, source: 'override' }} />)
    expect(screen.getByText('Based on a max of 175 bpm, set in Profile.')).toBeInTheDocument()
  })

  it('shows a zone under a minute as less than a minute', () => {
    render(<HeartRateZonesCard zones={{ ...ZONES, warmSeconds: 30 }} maxHeartRate={null} />)
    expect(screen.getByText('Warm <1m')).toBeInTheDocument()
  })
})

describe('zoneSummary', () => {
  it('lists the four zones in order', () => {
    expect(zoneSummary(NONE)).toBe('Warm 0m, Fat burn 0m, Cardio 0m, Peak 0m')
  })
})
