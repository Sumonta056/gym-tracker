import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  CaloriesDayCard,
  earlierOf,
  HeartRateDayCard,
  SAME_WORDS,
  seriesOf,
  StepsDayCard,
  todayOf,
  versusChip,
  WalkDayCard,
  weekdayOf,
  weighInChip,
  WeightDayCard,
} from './DayCards'

import type { DayPoint } from './rangeData'

const DATES = [
  '2026-09-17',
  '2026-09-18',
  '2026-09-19',
  '2026-09-20',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
]

const BLANK: Omit<DayPoint, 'date'> = {
  logged: false,
  weightKg: null,
  averageKg: null,
  calories: null,
  steps: null,
  avgHeartRate: null,
  maxHeartRate: null,
  gymSeconds: null,
  walkSeconds: null,
}

function week(patches: Partial<DayPoint>[]): DayPoint[] {
  return DATES.map((date, index) => ({ ...BLANK, date, ...patches[index] }))
}

const FULL = week([
  { steps: 7200, calories: 950, walkSeconds: 1500, avgHeartRate: 120, maxHeartRate: 160 },
  { steps: 9100, calories: 1100, walkSeconds: 2400, weightKg: 80.6, avgHeartRate: 118 },
  { steps: 6400, calories: 0, walkSeconds: 1200 },
  { steps: 10800, calories: 1020, walkSeconds: 2100, weightKg: 80.4 },
  { steps: 8300, calories: 870, walkSeconds: 1800 },
  { steps: 9800, calories: 1000, walkSeconds: 1800 },
  {
    steps: 12000,
    calories: 800,
    walkSeconds: 1800,
    weightKg: 80,
    avgHeartRate: 128,
    maxHeartRate: 171,
  },
])

const EMPTY = week([])

describe('the day card helpers', () => {
  it('reads the last point as today', () => {
    expect(todayOf(seriesOf(FULL, 'steps'))).toBe(12000)
  })

  it('reads null for today with no points', () => {
    expect(todayOf([])).toBeNull()
  })

  it('reads every point but the last as the earlier days', () => {
    expect(earlierOf(seriesOf(FULL, 'steps'))).toHaveLength(6)
  })

  it('names a weekday in short form', () => {
    expect(weekdayOf('2026-09-22')).toBe('Tue')
  })
})

describe('versusChip', () => {
  const format = (amount: number) => String(Math.round(amount))

  it('returns null when there is no comparison', () => {
    expect(versusChip(null, format, 1)).toBeNull()
  })

  it('words a rise against the average', () => {
    expect(versusChip({ average: 10, delta: 5, direction: 'up' }, format, 1)).toEqual({
      direction: 'up',
      text: '5 vs 6-day avg',
    })
  })

  it('words a fall with the amount and no sign', () => {
    expect(versusChip({ average: 10, delta: -5, direction: 'down' }, format, 1)?.text).toBe(
      '5 vs 6-day avg',
    )
  })

  it('calls a delta that shows as 0 the same', () => {
    expect(versusChip({ average: 600, delta: 20, direction: 'up' }, format, 60)).toEqual({
      direction: 'same',
      text: SAME_WORDS,
    })
  })

  it('calls an equal value the same', () => {
    expect(versusChip({ average: 10, delta: 0, direction: 'same' }, format, 1)?.direction).toBe(
      'same',
    )
  })
})

describe('weighInChip', () => {
  it('words the change since the weigh-in before today', () => {
    expect(weighInChip(FULL, 'metric')).toEqual({ direction: 'down', text: '0.4 kg since Sun' })
  })

  it('converts the change to pounds on the imperial setting', () => {
    expect(weighInChip(FULL, 'imperial')?.text).toBe('0.9 lb since Sun')
  })

  it('words a rise as up', () => {
    const rising = week([{ weightKg: 80 }, {}, {}, {}, {}, {}, { weightKg: 81 }])
    expect(weighInChip(rising, 'metric')?.direction).toBe('up')
  })

  it('words no change as the same', () => {
    const flat = week([{ weightKg: 80 }, {}, {}, {}, {}, {}, { weightKg: 80.01 }])
    expect(weighInChip(flat, 'metric')).toEqual({ direction: 'same', text: 'no change since Thu' })
  })

  it('returns null with one weigh-in', () => {
    expect(weighInChip(week([{}, {}, {}, {}, {}, {}, { weightKg: 80 }]), 'metric')).toBeNull()
  })
})

describe('StepsDayCard', () => {
  it('shows the value, the ring, the goal line and the chip', () => {
    render(<StepsDayCard days={FULL} stepGoal={6000} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Steps' })).toBeInTheDocument()
    expect(screen.getByText('12,000')).toBeInTheDocument()
    expect(screen.getByText('200%')).toBeInTheDocument()
    expect(screen.getByText('✓ reached')).toHaveClass('text-ok')
    expect(screen.getByText('3,400 vs 6-day avg')).toBeInTheDocument()
    expect(screen.getByText('6-day avg 8,600')).toBeInTheDocument()
  })

  it('leaves out the ring and the goal line with no goal', () => {
    render(<StepsDayCard days={FULL} stepGoal={null} />)
    expect(screen.queryByTestId('goal-ring')).toBeNull()
    expect(screen.queryByText(/goal/)).toBeNull()
    expect(screen.queryByTestId('spark-goal')).toBeNull()
  })

  it('treats a goal of 0 as no goal', () => {
    render(<StepsDayCard days={FULL} stepGoal={0} />)
    expect(screen.queryByTestId('goal-ring')).toBeNull()
    expect(screen.queryByTestId('spark-goal')).toBeNull()
  })

  it('shows the empty copy with no steps today', () => {
    render(<StepsDayCard days={EMPTY} stepGoal={6000} />)
    expect(screen.getByText('Log your steps to see them against your goal.')).toBeInTheDocument()
    expect(screen.queryByTestId('day-sparkline')).toBeNull()
  })

  it('hides the chip and the average with fewer than 2 earlier days', () => {
    render(
      <StepsDayCard
        days={week([{ steps: 100 }, {}, {}, {}, {}, {}, { steps: 500 }])}
        stepGoal={6000}
      />,
    )
    expect(screen.queryByText(/vs 6-day avg/)).toBeNull()
    expect(screen.queryByText(/6-day avg/)).toBeNull()
  })

  it('passes the class name to the card', () => {
    render(<StepsDayCard days={FULL} stepGoal={6000} className="md:col-span-2" />)
    expect(screen.getByTestId('day-card')).toHaveClass('md:col-span-2')
  })
})

describe('CaloriesDayCard', () => {
  it('shows the value in kcal, the share of the goal and what is left', () => {
    render(<CaloriesDayCard days={FULL} goal={1000} />)
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('kcal')).toBeInTheDocument()
    expect(screen.getByText('goal 1,000 · 200 to go')).toBeInTheDocument()
    expect(screen.getByText('▼')).toBeInTheDocument()
  })

  it('lists the values in kcal in the text alternative', () => {
    render(<CaloriesDayCard days={FULL} goal={1000} />)
    expect(screen.getByText('Today: 800 kcal')).toBeInTheDocument()
  })
})

describe('WalkDayCard', () => {
  it('formats the walk and the goal through lib/duration', () => {
    render(<WalkDayCard days={FULL} goalSeconds={1800} />)
    expect(screen.getByText('30m')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText(/goal 30m/)).toBeInTheDocument()
  })

  it('calls a walk within a minute of the average the same', () => {
    render(<WalkDayCard days={FULL} goalSeconds={1800} />)
    expect(screen.getByText(SAME_WORDS)).toBeInTheDocument()
  })
})

describe('WeightDayCard', () => {
  it('shows the weight, the change since the last weigh-in and a line', () => {
    render(<WeightDayCard days={FULL} unit="metric" targetKg={78} />)
    expect(screen.getByText('80.0')).toBeInTheDocument()
    expect(screen.getByText('0.4 kg since Sun')).toBeInTheDocument()
    expect(screen.getByText('goal 78.0 kg')).toBeInTheDocument()
    expect(screen.getByTestId('day-sparkline')).toHaveAttribute('data-variant', 'line')
    expect(screen.queryByTestId('goal-ring')).toBeNull()
  })

  it('shows the weight in pounds on the imperial setting', () => {
    render(<WeightDayCard days={FULL} unit="imperial" targetKg={null} />)
    expect(screen.getByText('176.4')).toBeInTheDocument()
    expect(screen.getByText('lb')).toBeInTheDocument()
    expect(screen.getByText('Today: 176.4 lb')).toBeInTheDocument()
  })

  it('shows no summary with no target', () => {
    render(<WeightDayCard days={FULL} unit="metric" targetKg={null} />)
    expect(screen.queryByText(/goal/)).toBeNull()
  })

  it('shows the sparse hint and no line with one weigh-in', () => {
    render(
      <WeightDayCard
        days={week([{}, {}, {}, {}, {}, {}, { weightKg: 80 }])}
        unit="metric"
        targetKg={null}
      />,
    )
    expect(screen.getByText('Log one more day to see a trend.')).toBeInTheDocument()
    expect(screen.queryByTestId('day-sparkline')).toBeNull()
  })

  it('shows the empty copy with no weight today', () => {
    render(<WeightDayCard days={EMPTY} unit="metric" targetKg={78} />)
    expect(
      screen.getByText('Log a weight to see the trend and its 7-day average.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('goal 78.0 kg')).toBeNull()
  })
})

describe('HeartRateDayCard', () => {
  it('shows the average and highest tiles with no zone bar', () => {
    render(<HeartRateDayCard days={FULL} />)
    expect(screen.getByText('128')).toBeInTheDocument()
    expect(screen.getByText('171')).toBeInTheDocument()
    expect(screen.getByText('9 bpm avg vs 6-day avg')).toBeInTheDocument()
    expect(screen.getByText('6-day avg 119 bpm')).toBeInTheDocument()
    expect(screen.queryByTestId('day-sparkline')).toBeNull()
  })

  it('says a missing reading is not logged', () => {
    render(<HeartRateDayCard days={week([{}, {}, {}, {}, {}, {}, { maxHeartRate: 170 }])} />)
    expect(screen.getByText('Not logged')).toBeInTheDocument()
    expect(screen.queryByText(/vs 6-day avg/)).toBeNull()
  })

  it('shows the empty copy with no heart rate today', () => {
    render(<HeartRateDayCard days={EMPTY} />)
    expect(
      screen.getByText('Log an average or a peak heart rate to see the trend.'),
    ).toBeInTheDocument()
  })
})
