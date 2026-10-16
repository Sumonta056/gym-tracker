import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { zoneBands } from '../../lib/metrics/heartRateZones'

import {
  bandText,
  factLine,
  HeartRateZonesCard,
  referenceBpm,
  zoneSummary,
} from './HeartRateZonesCard'

const ZONES = {
  warmSeconds: 480,
  fatBurnSeconds: 2280,
  cardioSeconds: 1260,
  peakSeconds: 300,
}

const NONE = { warmSeconds: 0, fatBurnSeconds: 0, cardioSeconds: 0, peakSeconds: 0 }

const MAX = { bpm: 190, source: 'age' } as const

function row(name: string): HTMLElement {
  const found = screen.getAllByRole('listitem').find((item) => item.textContent.startsWith(name))
  if (found === undefined) {
    throw new Error(`no row for ${name}`)
  }
  return found
}

describe('HeartRateZonesCard', () => {
  it('gives the ring a text alternative with every zone', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(
      screen.getByRole('img', {
        name: 'Heart rate zones: Warm 8m, Fat burn 38m, Cardio 21m, Peak 5m',
      }),
    ).toBeInTheDocument()
  })

  it('draws one ring segment for each zone with time', () => {
    const { container } = render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(container.querySelectorAll('circle[data-zone]')).toHaveLength(4)
  })

  it('leaves out a zone with no time from the ring', () => {
    const { container } = render(
      <HeartRateZonesCard zones={{ ...ZONES, peakSeconds: 0 }} maxHeartRate={null} />,
    )
    expect(container.querySelector('circle[data-zone="peak"]')).toBeNull()
  })

  it('shows the gym time in the centre of the ring', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(screen.getByText('1h 12m')).toBeInTheDocument()
    expect(screen.getByText('gym time')).toBeInTheDocument()
  })

  it('names the hard effort as the cardio and the peak time', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(screen.getByText('26m')).toBeInTheDocument()
    expect(screen.getByText('hard effort, cardio and peak')).toBeInTheDocument()
  })

  it('lists the zones with the hardest first', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} />)
    const names = screen.getAllByRole('listitem').map((item) => item.textContent.split(' ')[0])
    expect(names).toEqual(['Peak', 'Cardio', 'Fat', 'Warm'])
  })

  it('prints the time, the share and the bpm range on each row', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} />)
    const cardio = row('Cardio')
    expect(cardio).toHaveTextContent('133–161 bpm')
    expect(cardio).toHaveTextContent('21m')
    expect(cardio).toHaveTextContent('29%')
  })

  it('takes the bpm ranges from the peak when the max is not known', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} peakBpm={200} />)
    expect(row('Peak')).toHaveTextContent('170+ bpm')
  })

  it('shows no bpm range with no max and no peak', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(row('Peak')).not.toHaveTextContent('bpm')
  })

  it('shows the average, the peak and the max as pills', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} avgBpm={132} peakBpm={171} />)
    expect(screen.getByText('Avg').parentElement).toHaveTextContent('Avg 132')
    expect(
      screen.getByText('Peak', { selector: 'span.text-muted' }).parentElement,
    ).toHaveTextContent('Peak 171')
    expect(screen.getByText('Max').parentElement).toHaveTextContent('Max 190')
  })

  it('draws the effort scale with a marker for the average and the peak', () => {
    const { container } = render(
      <HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} avgBpm={95} peakBpm={190} />,
    )
    expect(
      screen.getByRole('img', {
        name: 'Heart rate scale to 190 bpm. Zones start at 114, 133, 162 bpm. Avg 95 bpm. Peak 190 bpm.',
      }),
    ).toBeInTheDocument()
    expect(container.querySelector('[data-marker="avg"]')).toHaveStyle({ left: '50%' })
    expect(container.querySelector('[data-marker="peak"]')).toHaveClass('-translate-x-full')
  })

  it('stretches the scale to a peak above the max', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} avgBpm={20} peakBpm={200} />)
    expect(screen.getByRole('img', { name: /^Heart rate scale to 200 bpm/ })).toBeInTheDocument()
  })

  it('keeps a marker near 0 inside the card', () => {
    const { container } = render(
      <HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} avgBpm={20} peakBpm={150} />,
    )
    expect(container.querySelector('[data-marker="avg"]')).toHaveClass('items-start')
  })

  it('draws no scale when there is no max and no peak', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(screen.queryByRole('img', { name: /Heart rate scale/ })).toBeNull()
  })

  it('says in which zones the average and the peak fell', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} avgBpm={100} peakBpm={200} />)
    expect(
      screen.getByText('Your average, 100 bpm, sits in Warm. Your peak reached Peak.'),
    ).toBeInTheDocument()
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
    expect(row('Warm')).toHaveTextContent('<1m')
  })
})

describe('referenceBpm', () => {
  it('prefers the max', () => {
    expect(referenceBpm(MAX, 100, 200)).toBe(190)
  })

  it('falls back to the session peak', () => {
    expect(referenceBpm(null, 100, 200)).toBe(200)
  })

  it('takes the average when it is above the peak, as the zone math does', () => {
    expect(referenceBpm(null, 150, 140)).toBe(150)
  })

  it('returns null with no max and no usable beat', () => {
    expect(referenceBpm(null, null, null)).toBeNull()
    expect(referenceBpm(null, 0, 0)).toBeNull()
  })
})

describe('factLine', () => {
  it('returns null without bands, an average or a peak', () => {
    expect(factLine(100, 200, null)).toBeNull()
    expect(factLine(null, 200, zoneBands(200))).toBeNull()
    expect(factLine(100, null, zoneBands(200))).toBeNull()
  })

  it('names the zone of the average and of the peak', () => {
    expect(factLine(130, 150, zoneBands(200))).toBe(
      'Your average, 130 bpm, sits in Fat burn. Your peak reached Cardio.',
    )
  })
})

describe('zoneSummary', () => {
  it('lists the four zones in order', () => {
    expect(zoneSummary(NONE)).toBe('Warm 0m, Fat burn 0m, Cardio 0m, Peak 0m')
  })
})

describe('bandText', () => {
  it('writes the warm band as under its top', () => {
    expect(bandText({ zone: 'warm', fromBpm: 0, toBpm: 113 })).toBe('under 114 bpm')
  })

  it('writes a middle band as a range', () => {
    expect(bandText({ zone: 'cardio', fromBpm: 133, toBpm: 161 })).toBe('133–161 bpm')
  })

  it('writes the peak band with no top', () => {
    expect(bandText({ zone: 'peak', fromBpm: 162, toBpm: null })).toBe('162+ bpm')
  })
})

describe('HeartRateZonesCard bands', () => {
  it('shows the bpm range of each zone when the max is known', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} />)
    for (const text of ['under 114 bpm', '114–132 bpm', '133–161 bpm', '162+ bpm']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })

  it('keeps the zone name in text beside its range', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} />)
    expect(screen.getByText('133–161 bpm').closest('li')).toHaveTextContent(
      'Cardio 133–161 bpm 21m 29%',
    )
  })

  it('shows no bpm range when the max is not known', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(screen.queryByText(/bpm$/)).not.toBeInTheDocument()
  })

  it('shows the info button in the empty state', () => {
    render(<HeartRateZonesCard zones={NONE} maxHeartRate={null} />)
    expect(screen.getByRole('button', { name: 'What the zones mean' })).toBeInTheDocument()
  })
})
