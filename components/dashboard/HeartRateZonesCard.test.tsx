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
    render(<HeartRateZonesCard zones={ZONES} />)
    expect(
      screen.getByRole('img', {
        name: 'Heart rate zones: Warm 8m, Fat burn 38m, Cardio 21m, Peak 5m',
      }),
    ).toBeInTheDocument()
  })

  it('prints the same numbers outside the bar', () => {
    render(<HeartRateZonesCard zones={ZONES} />)
    for (const text of ['Warm 8m', 'Fat burn 38m', 'Cardio 21m', 'Peak 5m']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })

  it('names the cardio time in the header', () => {
    render(<HeartRateZonesCard zones={ZONES} />)
    expect(screen.getByText('21m in cardio')).toBeInTheDocument()
  })

  it('draws four segments when every zone has time', () => {
    render(<HeartRateZonesCard zones={ZONES} />)
    expect(screen.getByRole('img').children).toHaveLength(4)
  })

  it('leaves out a zone with no time from the bar', () => {
    render(<HeartRateZonesCard zones={{ ...ZONES, peakSeconds: 0 }} />)
    expect(screen.getByRole('img').children).toHaveLength(3)
  })

  it('explains what to log when there is no zone time', () => {
    render(<HeartRateZonesCard zones={NONE} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/Log gym time/)).toBeInTheDocument()
  })
})

describe('zoneSummary', () => {
  it('lists the four zones in order', () => {
    expect(zoneSummary(NONE)).toBe('Warm 0m, Fat burn 0m, Cardio 0m, Peak 0m')
  })
})
