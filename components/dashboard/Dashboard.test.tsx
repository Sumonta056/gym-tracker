import { render, screen, within } from '@testing-library/react'
import { animate } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db, LOCAL_PROFILE_ID } from '../../lib/db/dexie'
import {
  getProfile,
  listRange,
  listSessions,
  listSetsInRange,
  setsForExercises,
} from '../../lib/db/repository'
import { formatDuration } from '../../lib/duration'
import { streak } from '../../lib/metrics/streak'
import { entryOn, NOW, PROFILE, TODAY } from '../../tests/fixtures/dashboard'
import { BENCH, liftSet, sessionOn } from '../../tests/fixtures/lifts'
import { setReducedMotion } from '../../tests/fixtures/motion'

import { Dashboard, DashboardView, stepsHint } from './Dashboard'
import { NO_LIFTS, summarise } from './summary'

import type { TodayLifts } from './summary'
import type { Profile } from '../../lib/db/dexie'
import type * as Repository from '../../lib/db/repository'

vi.mock('../../lib/db/repository', async () => {
  const { syncedStatus } = await import('../../tests/fixtures/sync')
  return {
    getProfile: vi.fn(),
    listRange: vi.fn(),
    listSessions: vi.fn(),
    listSetsInRange: vi.fn(),
    setsForExercises: vi.fn(),
    useSyncStatus: syncedStatus,
  }
})

vi.mock('motion/react', async (importOriginal) => {
  const original = await importOriginal<object>()
  return { ...original, animate: vi.fn(() => ({ stop: vi.fn() })) }
})

const clock = () => NOW

const STREAK_DATES = ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', TODAY]

beforeEach(() => {
  vi.mocked(listRange).mockResolvedValue([])
  vi.mocked(getProfile).mockResolvedValue(PROFILE)
  vi.mocked(listSessions).mockResolvedValue([])
  vi.mocked(listSetsInRange).mockResolvedValue([])
  vi.mocked(setsForExercises).mockResolvedValue([])
  vi.mocked(animate).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DashboardView motion', () => {
  const entries = [entryOn(TODAY, { gym_seconds: 4325 })]

  it('counts the hero number up once when it first appears', () => {
    setReducedMotion(false)
    render(<DashboardView summary={summarise(entries, PROFILE, TODAY, NOW)} />)
    expect(vi.mocked(animate)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(animate).mock.calls[0]?.slice(0, 2)).toEqual([0, 4325])
  })

  it('does not replay the count-up on a dashboard re-render', () => {
    setReducedMotion(false)
    const { rerender } = render(<DashboardView summary={summarise(entries, PROFILE, TODAY, NOW)} />)
    rerender(<DashboardView summary={summarise(entries, PROFILE, TODAY, NOW)} />)
    rerender(<DashboardView summary={summarise(entries, PROFILE, TODAY, NOW)} />)
    expect(vi.mocked(animate)).toHaveBeenCalledTimes(1)
  })

  it('runs no count-up and shows the final hero value at once with reduced motion', () => {
    setReducedMotion(true)
    render(<DashboardView summary={summarise(entries, PROFILE, TODAY, NOW)} />)
    expect(vi.mocked(animate)).not.toHaveBeenCalled()
    expect(screen.getByText(formatDuration(4325, 'clock'))).toBeVisible()
    expect(screen.getByText(formatDuration(4325, 'clock'))).not.toHaveClass('opacity-0')
  })
})

describe('Dashboard', () => {
  it('shows the profile initial once a pull writes the profile row, with no remount', async () => {
    const actual = await vi.importActual<typeof Repository>('../../lib/db/repository')
    vi.mocked(getProfile).mockImplementation(actual.getProfile)
    vi.mocked(listRange).mockImplementation(actual.listRange)
    vi.mocked(listSessions).mockImplementation(actual.listSessions)
    await db.open()
    await db.profiles.clear()

    render(<Dashboard clock={clock} />)
    const avatar = await screen.findByRole('link', { name: 'Profile' })
    expect(within(avatar).getByText('☰')).toBeInTheDocument()

    await db.profiles.put({ ...PROFILE, id: LOCAL_PROFILE_ID, display_name: 'A3 Check' })

    expect(await within(avatar).findByText('A')).toBeInTheDocument()
    db.close()
  })

  it('says it is reading the device while the entries load', () => {
    render(<Dashboard clock={clock} />)
    expect(screen.getByText('Reading this device…')).toHaveAttribute('role', 'status')
  })

  it('shows the empty state linking to /log when today has no entry', async () => {
    vi.mocked(listRange).mockResolvedValue([entryOn('2026-09-22')])
    render(<Dashboard clock={clock} />)
    expect(await screen.findByText('Nothing logged yet today.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log the day' })).toHaveAttribute('href', '/log')
  })

  it('shows the streak number from lib/metrics/streak', async () => {
    vi.mocked(listRange).mockResolvedValue(STREAK_DATES.map((date) => entryOn(date)))
    const expected = streak(STREAK_DATES, NOW).current
    render(<Dashboard clock={clock} />)
    expect(await screen.findByText(`${String(expected)} day streak`)).toBeInTheDocument()
    expect(expected).toBe(5)
  })

  it('shows the gym time for today through formatDuration', async () => {
    vi.mocked(listRange).mockResolvedValue([entryOn(TODAY, { gym_seconds: 4325 })])
    render(<Dashboard clock={clock} />)
    expect(await screen.findByText(formatDuration(4325, 'clock'))).toBeInTheDocument()
  })

  it('shows the result of an import as text after the import lands on /', async () => {
    window.history.replaceState(null, '', '/?imported=16.0.0.0.0')
    render(<Dashboard clock={clock} />)
    expect(await screen.findByTestId('import-notice')).toHaveTextContent(
      'The sheet is imported: 16 new, 0 overwritten, 0 merged, 0 skipped, 0 left out.',
    )
    window.history.replaceState(null, '', '/')
  })

  it('mounts the empty import status region while the entries still load', () => {
    render(<Dashboard clock={clock} />)
    const regions = screen.getAllByRole('status')
    expect(regions[0]).toBeEmptyDOMElement()
    expect(regions[0]).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Reading this device…')).toBeInTheDocument()
  })

  it('keeps the same import status region once the dashboard is ready', async () => {
    render(<Dashboard clock={clock} />)
    const region = screen.getAllByRole('status')[0]
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('status')[0]).toBe(region)
  })

  it('reports a read failure in words', async () => {
    vi.mocked(getProfile).mockRejectedValue(new Error('blocked'))
    render(<Dashboard clock={clock} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read')
  })
})

describe('DashboardView', () => {
  function view(entries = [entryOn(TODAY)], profile = PROFILE) {
    render(<DashboardView summary={summarise(entries, profile, TODAY, NOW)} />)
  }

  it('lays the cards out in one, two, then three columns', () => {
    view()
    const grid = screen.getByTestId('dashboard-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
  })

  it('shows the dates of this week on the week card', () => {
    view()
    expect(screen.getByText('21 – 27 Sep')).toBeVisible()
  })

  it('shows the steps against the goal from the profile', () => {
    view([entryOn('2026-09-22', { steps: 1000 }), entryOn(TODAY, { steps: 5909 })])
    expect(screen.getByText('5,909')).toBeInTheDocument()
    expect(screen.getByText('49% of 12,000')).toBeInTheDocument()
  })

  it('shows the latest weight in kilograms', () => {
    view([entryOn(TODAY, { weight_kg: 73.65 })])
    expect(screen.getByText('73.65')).toBeInTheDocument()
    expect(screen.getByText('kg')).toBeInTheDocument()
  })

  it('shows the latest weight in pounds when the profile is imperial', () => {
    view([entryOn(TODAY, { weight_kg: 71 })], { ...PROFILE, unit_system: 'imperial' })
    expect(screen.getByText('156.5')).toBeInTheDocument()
    expect(screen.getByText('lb')).toBeInTheDocument()
  })

  it('reads the weight trend out in pounds when the profile is imperial', () => {
    view([entryOn('2026-09-22', { weight_kg: 71 }), entryOn(TODAY, { weight_kg: 70 })], {
      ...PROFILE,
      unit_system: 'imperial',
    })
    expect(screen.getByText('Weight series: 156.5, 154.3')).toBeInTheDocument()
  })

  it('draws the weight trend once two weights exist', () => {
    view([entryOn('2026-09-22', { weight_kg: 74 }), entryOn(TODAY, { weight_kg: 73.65 })])
    expect(screen.getByText('Weight series: 74, 73.65')).toBeInTheDocument()
  })

  it('hides the steps and weight cards when neither was ever logged', () => {
    view([])
    expect(screen.queryByText('Steps')).toBeNull()
    expect(screen.queryByText('Weight')).toBeNull()
    expect(screen.queryByText('—')).toBeNull()
    expect(screen.queryByText('Not logged yet')).toBeNull()
    expect(screen.queryByText('Goal 12,000')).toBeNull()
  })

  it('shows the calories and the walk time as their own stat cards', () => {
    view()
    expect(screen.getByText('Calories')).toBeVisible()
    expect(screen.getAllByText('963')).toHaveLength(2)
    expect(screen.getByText('Walk')).toBeVisible()
    expect(screen.getByText(formatDuration(3324, 'short'))).toBeVisible()
    expect(screen.queryByText('Kcal')).toBeNull()
  })

  it('shows the heart rate zones and the week totals', () => {
    view()
    expect(screen.getByRole('heading', { name: 'Heart rate zones' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument()
  })

  it('names the max heart rate of the profile under the zones', () => {
    view([entryOn(TODAY)], { ...PROFILE, birth_year: 1996 })
    expect(screen.getByText('Based on a max of 190 bpm, from your birth year.')).toBeVisible()
  })
})

describe('stepsHint', () => {
  it('rounds the share of the goal', () => {
    expect(stepsHint(12480, 12000)).toBe('104% of 12,000')
  })
})

describe('DashboardView, a full Today', () => {
  const GOALS: Profile = {
    ...PROFILE,
    calorie_goal: 800,
    walk_goal_seconds: 3600,
    target_weight_kg: 71.25,
  }

  function view(
    entries = [entryOn(TODAY)],
    profile: Profile = GOALS,
    lifts: TodayLifts = NO_LIFTS,
  ) {
    render(<DashboardView summary={summarise(entries, profile, TODAY, NOW, lifts)} />)
  }

  it('hides each card that has no value, with no 0 and no dash', () => {
    view([
      entryOn(TODAY, {
        steps: null,
        calories_burnt: null,
        walk_seconds: null,
        swim_seconds: null,
        weight_kg: null,
        note: null,
      }),
    ])
    for (const label of ['Steps', 'Calories', 'Walk', 'Swim', 'Weight', 'Note']) {
      expect(screen.queryByText(label)).toBeNull()
    }
    expect(screen.queryByText('—')).toBeNull()
  })

  it.each([
    ['Steps', { steps: null }],
    ['Calories', { calories_burnt: null }],
    ['Walk', { walk_seconds: null }],
    ['Swim', { swim_seconds: null }],
    ['Weight', { weight_kg: null }],
  ] as const)('hides the %s card alone when its value is null', (label, patch) => {
    view([entryOn(TODAY, { swim_seconds: 1500, ...patch })])
    expect(screen.queryByText(label)).toBeNull()
    const others = ['Steps', 'Calories', 'Walk', 'Swim', 'Weight'].filter(
      (other) => other !== label,
    )
    for (const other of others) {
      expect(screen.getByText(other)).toBeVisible()
    }
  })

  it('shows no 0 for a stat card with no value', () => {
    view([
      entryOn(TODAY, {
        steps: null,
        calories_burnt: null,
        walk_seconds: null,
        swim_seconds: null,
        weight_kg: null,
      }),
    ])
    const stats = screen.getByRole('region', { name: 'Today' }).nextElementSibling
    expect(stats).not.toBeNull()
    expect(stats?.textContent).toBe('')
    expect(screen.queryByText('0% of 800 kcal')).toBeNull()
  })

  it('hides the note card when the note is null', () => {
    view([entryOn(TODAY, { note: null })])
    expect(screen.queryByRole('heading', { name: 'Note' })).toBeNull()
  })

  it('shows calories against the calorie goal', () => {
    view()
    expect(screen.getByText('120% of 800 kcal')).toBeVisible()
  })

  it('draws the calorie goal bar full when the goal is passed', () => {
    view()
    expect(screen.getByRole('progressbar', { name: 'Calories progress' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
  })

  it('shows calories with no bar when there is no goal', () => {
    view([entryOn(TODAY)], PROFILE)
    expect(screen.getByText('Calories')).toBeVisible()
    expect(screen.queryByText(/% of .* kcal/)).toBeNull()
  })

  it('draws no calorie bar when there is no calorie goal', () => {
    view([entryOn(TODAY)], PROFILE)
    expect(screen.queryByRole('progressbar', { name: 'Calories progress' })).toBeNull()
  })

  it('shows the walk time against the walk goal', () => {
    view()
    expect(screen.getByText('92% of 1h')).toBeVisible()
  })

  it('draws the walk goal bar with the share of the goal', () => {
    view()
    expect(screen.getByRole('progressbar', { name: 'Walk progress' })).toHaveAttribute(
      'aria-valuenow',
      '92',
    )
  })

  it('shows the swim time', () => {
    view([entryOn(TODAY, { swim_seconds: 1500 })])
    expect(screen.getByText('Swim')).toBeVisible()
    expect(screen.getByText('25m')).toBeVisible()
  })

  it('draws no bar on the swim card', () => {
    view([entryOn(TODAY, { swim_seconds: 1500 })])
    expect(screen.queryByRole('progressbar', { name: 'Swim progress' })).toBeNull()
  })

  it('shows the gap to the target weight', () => {
    view()
    expect(screen.getByText('2.4 kg to go')).toBeVisible()
  })

  it('says latest entry on the weight card with no target', () => {
    view([entryOn(TODAY)], PROFILE)
    expect(screen.getByText('Latest entry')).toBeVisible()
    expect(screen.queryByText(/to go$/)).toBeNull()
  })

  it('shows the note', () => {
    view([entryOn(TODAY, { note: 'Felt strong.' })])
    expect(screen.getByRole('heading', { name: 'Note' })).toBeInTheDocument()
    expect(screen.getByText('Felt strong.')).toBeVisible()
  })

  it('hides a blank note', () => {
    view([entryOn(TODAY, { note: '   ' })])
    expect(screen.queryByRole('heading', { name: 'Note' })).toBeNull()
  })

  it('lists the workout of today with a link to its detail', () => {
    const session = sessionOn(TODAY)
    const lifts = { sessions: [session], sets: [liftSet(session, BENCH, 10, 60)], earlierSets: [] }
    view([entryOn(TODAY, { gym_seconds: null })], GOALS, lifts)
    expect(screen.getByRole('link', { name: /1h · 1 set · 600 kg/ })).toHaveAttribute(
      'href',
      `/workouts?session=${session.id}`,
    )
    expect(screen.getByText('From your sessions')).toBeVisible()
  })

  it('hides the workout card with no session', () => {
    view()
    expect(screen.queryByRole('heading', { name: 'Workout today' })).toBeNull()
  })

  it('shows the gym time of a day with only a session, not the nothing logged state', () => {
    const session = sessionOn(TODAY)
    const lifts = { sessions: [session], sets: [liftSet(session, BENCH, 10, 60)], earlierSets: [] }
    view([], GOALS, lifts)
    expect(screen.queryByText('Nothing logged yet today.')).toBeNull()
    expect(screen.getByText(formatDuration(3600, 'clock'))).toBeInTheDocument()
  })

  it('puts the cards in the order of the design', () => {
    const session = sessionOn(TODAY)
    const lifts = { sessions: [session], sets: [liftSet(session, BENCH, 10, 60)], earlierSets: [] }
    view([entryOn(TODAY, { swim_seconds: 1500, note: 'Felt strong.' })], GOALS, lifts)
    const grid = within(screen.getByTestId('dashboard-grid'))
    const order = [
      grid.getByRole('region', { name: 'Today' }),
      grid.getByText('Steps'),
      grid.getByText('Calories'),
      grid.getByText('Walk'),
      grid.getByText('Swim'),
      grid.getByText('Weight'),
      grid.getByRole('heading', { name: 'Workout today' }),
      grid.getByRole('heading', { name: 'Note' }),
      grid.getByRole('heading', { name: 'Heart rate zones' }),
      grid.getByRole('heading', { name: 'This week' }),
    ]
    for (let index = 1; index < order.length; index += 1) {
      const before = order[index - 1] as HTMLElement
      const after = order[index] as HTMLElement
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }
  })
})
