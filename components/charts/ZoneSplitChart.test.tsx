import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'

import { analyse } from './rangeData'
import { ZoneSplitChart } from './ZoneSplitChart'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const empty = analyse([], [], 'week', TODAY, NOW, 12000)
const full = analyse(
  [entryOn(TODAY, { gym_seconds: 3600, avg_heart_rate: 120, max_heart_rate: 180 })],
  [],
  'day',
  TODAY,
  NOW,
  12000,
)

describe('ZoneSplitChart', () => {
  it('shows its empty state for an empty series, without throwing', () => {
    render(<ZoneSplitChart zones={empty.zones} date={TODAY} maxHeartRate={null} />)
    expect(
      screen.getByText("Log gym time with an average and a peak heart rate to see today's zones."),
    ).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('names the split of the selected day in its label', () => {
    render(<ZoneSplitChart zones={full.zones} date={TODAY} maxHeartRate={null} />)
    expect(
      screen.getByRole('img', {
        name: 'Heart rate zones on 23 September: Warm 24m, Fat burn 9m, Cardio 13m, Peak 13m',
      }),
    ).toBeInTheDocument()
  })

  it('reads every zone outside the bar', () => {
    render(<ZoneSplitChart zones={full.zones} date={TODAY} maxHeartRate={null} />)
    for (const text of ['Warm 24m', 'Fat burn 9m', 'Cardio 13m', 'Peak 13m']) {
      expect(screen.getByText(text)).toBeVisible()
    }
  })

  it('stacks the four zones in one bar', () => {
    const { container } = render(
      <ZoneSplitChart zones={full.zones} date={TODAY} maxHeartRate={null} />,
    )
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(4)
  })

  it('asks for the birth year in its footer when the max is not known', () => {
    render(<ZoneSplitChart zones={full.zones} date={TODAY} maxHeartRate={null} />)
    expect(screen.getByText('Add your birth year in Profile for real zones.')).toBeVisible()
  })

  it('names the max and its source in its footer when the max is known', () => {
    render(
      <ZoneSplitChart zones={full.zones} date={TODAY} maxHeartRate={{ bpm: 190, source: 'age' }} />,
    )
    expect(screen.getByText('Based on a max of 190 bpm, from your birth year.')).toBeVisible()
  })
})
