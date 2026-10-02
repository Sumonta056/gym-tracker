import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'

import StyleguidePage from './page'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

describe('the styleguide route guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is not found when the flag is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_STYLEGUIDE', '')
    expect(() => {
      render(<StyleguidePage />)
    }).toThrow('NEXT_NOT_FOUND')
  })
})

describe('the styleguide page', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_STYLEGUIDE', '1')
    render(<StyleguidePage />)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders inside the app shell', () => {
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Bottom navigation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Style guide' })).toBeInTheDocument()
  })

  it('renders a swatch for every colour token', () => {
    for (const [name, value] of Object.entries(colorTokens)) {
      expect(screen.getByText(name)).toBeInTheDocument()
      expect(screen.getAllByText(value).length).toBeGreaterThan(0)
    }
  })

  it('renders every type step', () => {
    for (const step of ['Hero number', 'Stat number', 'Title', 'Body text', 'Small', 'Caption']) {
      expect(screen.getByText(step)).toBeInTheDocument()
    }
  })

  it('renders every primitive section', () => {
    for (const heading of [
      'Colour tokens',
      'Radius tokens',
      'Type scale',
      'Cards',
      'Stat cards',
      'Dashboard',
      'Analytics',
      'Profile',
      'Status chips',
      'Segmented tabs',
      'Fields',
      'Sign in',
      'Buttons and the sheet',
      'Exercise picker',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
    }
  })

  it('renders the hero card and the four sync chips', () => {
    expect(screen.getAllByText('Gym time today').length).toBeGreaterThan(0)
    const chips = within(screen.getByTestId('status-chips'))
    for (const word of ['Synced', 'Syncing', 'Offline', 'Pending']) {
      expect(chips.getByText(word)).toBeInTheDocument()
    }
  })

  it('renders the profile sample with the import card hidden, as the flag is off', () => {
    const grid = within(screen.getByTestId('profile-grid-sample'))
    expect(grid.getByLabelText('Target weight (kg)')).toHaveValue('71.0')
    expect(grid.queryByRole('button', { name: 'Import the old sheet' })).not.toBeInTheDocument()
    expect(screen.getByTestId('data-card')).toBeInTheDocument()
  })

  it('renders the import review sample with its review cells and its error row', () => {
    const sample = within(screen.getByTestId('import-review-sample'))
    expect(sample.getByTestId('import-count')).toHaveTextContent('2 of 2 cells')
    expect(sample.getByRole('button', { name: 'Apply import' })).toBeDisabled()
    expect(sample.getAllByText(/This row is left out of the import\./).length).toBeGreaterThan(0)
  })

  it('switches the profile sample to imperial from its unit toggle', async () => {
    const grid = within(screen.getByTestId('profile-grid-sample'))
    await userEvent.click(grid.getByRole('button', { name: 'Imperial' }))
    expect(grid.getByLabelText('Target weight (lb)')).toHaveValue('156.5')
  })

  it('saves a profile sample target into its own state', async () => {
    const grid = within(screen.getByTestId('profile-grid-sample'))
    const field = grid.getByLabelText('Daily step goal')
    await userEvent.clear(field)
    await userEvent.type(field, '9000')
    await userEvent.tab()
    expect(grid.getByLabelText('Daily step goal')).toHaveValue('9000')
  })

  it('shows the pending warning on the profile sample and clears it with Sync now', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Show two pending writes' }))
    const grid = within(screen.getByTestId('profile-grid-sample'))
    expect(
      grid.getByText('2 writes have not reached the server yet. Signing out now loses them.'),
    ).toBeInTheDocument()
    await userEvent.click(grid.getByRole('button', { name: 'Sync now' }))
    expect(grid.getByText('Signing out clears every entry on this device.')).toBeInTheDocument()
    await userEvent.click(grid.getByRole('button', { name: 'Sign out' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show two pending writes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear the pending writes' }))
    expect(screen.getByRole('button', { name: 'Show two pending writes' })).toBeInTheDocument()
  })

  it('opens the sign-out confirm sheet on the profile sample while writes wait', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Show two pending writes' }))
    const grid = within(screen.getByTestId('profile-grid-sample'))
    await userEvent.click(grid.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByRole('dialog', { name: 'Sign out with unsynced writes?' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(grid.getByRole('button', { name: 'Sign out' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sign out and lose 2 writes' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the sign-out error on the profile sample when asked', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Show the sign-out error' }))
    const grid = within(screen.getByTestId('profile-grid-sample'))
    expect(grid.getByRole('alert')).toHaveTextContent('comes back from the server')
    await userEvent.click(screen.getByRole('button', { name: 'Hide the sign-out error' }))
    expect(grid.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the sync card with a write the server refused', () => {
    expect(screen.getByRole('list', { name: 'Failed writes' })).toHaveTextContent(
      'Sunday 13 September',
    )
    expect(screen.getByRole('button', { name: 'Retry Sunday 13 September' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard Sunday 13 September' })).toBeInTheDocument()
  })

  it('keeps the refused write sample still when its Sync now is pressed', async () => {
    const card = within(screen.getByTestId('sync-card-refused'))
    await userEvent.click(card.getByRole('button', { name: 'Sync now' }))
    expect(card.getByRole('list', { name: 'Failed writes' })).toBeInTheDocument()
  })

  it('shows the sync card offline and syncing', () => {
    expect(
      screen.getByText('Offline. The writes wait on this device until the network is back.'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Syncing…' }).length).toBeGreaterThan(0)
  })

  it('renders the dashboard hero, its empty state, the zone bar and the week totals', () => {
    expect(screen.getByText('4 day streak')).toBeInTheDocument()
    const empty = screen.getByText('Nothing logged yet today.').closest('section')
    expect(empty).not.toBeNull()
    expect(within(empty as HTMLElement).getByRole('link', { name: 'Log the day' })).toHaveAttribute(
      'href',
      '/log',
    )
    expect(screen.getByRole('img', { name: /^Heart rate zones: Warm 8m/ })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2, name: 'This week' }).length).toBeGreaterThan(
      0,
    )
  })

  it('renders the full dashboard screen on a heavy day, the weight and steps in their stat cards', () => {
    const sample = screen.getByTestId('dashboard-sample')
    expect(within(sample).getByTestId('dashboard-grid')).toBeInTheDocument()
    expect(within(sample).getByText('103.40')).toBeInTheDocument()
    expect(within(sample).getByText('13,100')).toBeInTheDocument()
  })

  it('renders the heavy week in pounds, every chart with a text alternative', () => {
    const grid = screen.getByTestId('analytics-grid-heavy')
    expect(within(grid).getAllByRole('img')).toHaveLength(7)
    expect(
      within(grid).getByRole('img', { name: /^Weight per day: .* pounds\./ }),
    ).toBeInTheDocument()
  })

  it('renders the daily log form with every field labelled', () => {
    const sample = screen.getByTestId('log-sample')
    for (const label of [
      'Gym time',
      'Walk time',
      'Avg heart rate',
      'Max heart rate',
      'Weight (kg)',
      'Calories',
      'Steps',
      'Note',
    ]) {
      expect(within(sample).getByLabelText(label)).toBeInTheDocument()
    }
    expect(within(sample).getByRole('button', { name: 'Save entry' })).toHaveAttribute(
      'type',
      'submit',
    )
  })

  it('renders the seven analytics charts from the sample week, each with a text alternative', () => {
    const grid = screen.getByTestId('analytics-grid')
    expect(within(grid).getAllByRole('img')).toHaveLength(7)
    expect(
      within(grid).getByRole('img', {
        name: 'Weight per day: 74.1, 73.9, 74.2, 73.7, 73.6, 73.5, 73.4 kilograms. Seven day average falling, 73.8 on the last day.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('14 – 20 September')).toBeInTheDocument()
  })

  it('shows the range tabs under the analytics header, on the week', () => {
    const section = screen.getByRole('heading', { level: 2, name: 'Analytics' }).closest('section')
    const tabs = within(section as HTMLElement).getByRole('group', { name: 'Range' })
    expect(within(tabs).getByRole('button', { name: 'Week' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches the analytics sample to the month from its range tabs', async () => {
    const section = screen.getByRole('heading', { level: 2, name: 'Analytics' }).closest('section')
    await userEvent.click(within(section as HTMLElement).getByRole('button', { name: 'Month' }))
    expect(within(section as HTMLElement).getByText('1 – 30 September')).toBeInTheDocument()
  })

  it('renders the one logged day sample, with its not enough data state and ghost slots', () => {
    expect(screen.getByRole('heading', { level: 3, name: 'One logged day' })).toBeInTheDocument()
    const grid = screen.getByTestId('analytics-grid-one-day')
    expect(within(grid).getAllByText('Log one more day to see a trend.')).toHaveLength(2)
    expect(within(grid).getAllByRole('img').length).toBeGreaterThan(0)
  })

  it('renders the lifting charts from the sample week, each with a text alternative', () => {
    const grid = screen.getByTestId('lift-grid')
    expect(within(grid).getAllByRole('img')).toHaveLength(2)
    expect(within(grid).getByRole('heading', { name: 'Personal records' })).toBeInTheDocument()
    expect(within(grid).getByText('New today')).toBeInTheDocument()
  })

  it('renders the lifting charts with one session and with none', () => {
    const one = screen.getByTestId('lift-grid-one-session')
    expect(within(one).getByText('Log one more session to see a trend.')).toBeInTheDocument()
    const none = screen.getByTestId('lift-grid-empty')
    expect(
      within(none).getByText('Finish a set with a load to see your records.'),
    ).toBeInTheDocument()
    expect(within(none).queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the week charts from the plate sample, with the balance warning', () => {
    const grid = screen.getByTestId('week-grid')
    expect(within(grid).getAllByRole('img')).toHaveLength(3)
    expect(within(grid).getByRole('note')).toHaveTextContent(/^Legs behind: /)
  })

  it('renders the week charts with one session and with none', () => {
    const one = screen.getByTestId('week-grid-one-session')
    expect(within(one).getByText('Log one more session to see a trend.')).toBeInTheDocument()
    expect(within(one).getAllByRole('img')).toHaveLength(1)
    const none = screen.getByTestId('week-grid-empty')
    expect(within(none).queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders a chart in its empty state', () => {
    expect(screen.getByText('Log your steps to see them per day.')).toBeInTheDocument()
  })

  it('shows the duration field already formatted from stored seconds', () => {
    expect(within(screen.getByTestId('duration-sample')).getByLabelText('Gym time')).toHaveValue(
      '1:12:05',
    )
    expect(screen.getByText('Stored seconds: 4325')).toBeInTheDocument()
  })

  it('shows the weight nudge pair from the daily log', async () => {
    const sample = within(screen.getByTestId('nudge-sample'))
    const weight = sample.getByLabelText('Weight (kg)')
    expect(weight).toHaveValue('73.40')
    await userEvent.click(sample.getByRole('button', { name: '+0.05 kg, increase the weight' }))
    expect(weight).toHaveValue('73.45')
  })

  it('switches the segmented tabs', async () => {
    const section = screen
      .getByRole('heading', { level: 2, name: 'Segmented tabs' })
      .closest('section')
    await userEvent.click(within(section as HTMLElement).getByRole('button', { name: 'Month' }))
    expect(screen.getByText('Selected: month')).toBeInTheDocument()
  })

  it('opens and closes the sheet', async () => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    expect(screen.getByRole('dialog', { name: 'Log a set' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close Log a set' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stores the seconds the duration field reports', async () => {
    const field = within(screen.getByTestId('duration-sample')).getByLabelText('Gym time')
    await userEvent.clear(field)
    await userEvent.type(field, '72m')
    await userEvent.tab()
    expect(screen.getByText('Stored seconds: 4320')).toBeInTheDocument()
  })

  it('closes the sheet from its save button', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('holds the error state back until it is asked for, so nothing shouts on arrival', () => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('number-sample')).getByLabelText('Steps')).not.toHaveAttribute(
      'aria-invalid',
    )
  })

  it('shows an errored field tied to its message', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Show the error state' }))
    const steps = within(screen.getByTestId('number-sample')).getByLabelText('Steps')
    expect(steps).toHaveAttribute('aria-invalid', 'true')
    expect(steps).toHaveAccessibleDescription('Enter a whole number')
  })

  it('shows an errored email field tied to its message', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Show the email error' }))
    const email = screen.getByLabelText('Email, rejected')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Enter an email address like you@example.com.')
  })

  it('shows the password field with its input masked', () => {
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('renders the brand mark from the shared component', () => {
    expect(screen.getByText('GT')).toHaveAttribute('aria-hidden', 'true')
  })

  it('opens the manage exercises sample with its own, archived and built in lists', async () => {
    await userEvent.click(
      within(screen.getByTestId('profile-grid-sample')).getByRole('button', {
        name: 'Manage exercises',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Manage exercises' })
    expect(await within(dialog).findByRole('region', { name: 'Yours · 2 active' })).toBeVisible()
    expect(within(dialog).getByRole('region', { name: 'Archived · 1' })).toBeVisible()
    expect(within(dialog).getByRole('region', { name: 'Built in · 11' })).toBeVisible()
  })

  it('archives, restores and renames in the manage exercises sample', async () => {
    await userEvent.click(
      within(screen.getByTestId('profile-grid-sample')).getByRole('button', {
        name: 'Manage exercises',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Manage exercises' })
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Archive Cable Fly' }))
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Restore Cable Fly' }))
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Rename Cable Fly' }))
    const input = within(dialog).getByLabelText('New name for Cable Fly')
    await userEvent.clear(input)
    await userEvent.type(input, 'Low Cable Fly{Enter}')
    expect(
      await within(dialog).findByRole('button', { name: 'Rename Low Cable Fly' }),
    ).toBeInTheDocument()
  })

  it('opens the exercise picker sample with its recent list', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the exercise picker' }))
    const dialog = screen.getByRole('dialog', { name: 'Pick an exercise' })
    const recent = await within(dialog).findByRole('region', { name: 'Recent' })
    expect(within(recent).getAllByRole('button')[0]).toHaveTextContent('Chest · 75 kg × 8')
    expect(within(recent).getAllByRole('button')[0]).toHaveTextContent('2d')
  })

  it('searches the picker sample and picks the match', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the exercise picker' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'CURL')
    const matches = await screen.findByRole('region', { name: 'Matches' })

    await userEvent.click(within(matches).getByRole('button', { name: /Barbell Curl/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('picker-sample')).getByText('Picked: Barbell Curl'),
    ).toBeInTheDocument()
  })

  it('filters the picker sample by a muscle group chip', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the exercise picker' }))
    const dialog = screen.getByRole('dialog', { name: 'Pick an exercise' })
    await within(dialog).findByRole('region', { name: 'Recent' })

    await userEvent.click(
      within(within(dialog).getByRole('group', { name: 'Muscle group' })).getByRole('button', {
        name: 'Core',
      }),
    )

    await waitFor(() => {
      const all = within(dialog).getByRole('region', { name: 'All exercises' })
      expect(within(all).getAllByRole('button')).toHaveLength(1)
    })
  })

  it('creates an exercise in the picker sample and picks it', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the exercise picker' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create a new exercise' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Hack Squat')
    await userEvent.click(screen.getByRole('button', { name: 'Legs' }))

    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    expect(await screen.findByText('Picked: Hack Squat')).toBeInTheDocument()
  })

  it('closes the picker sample on Escape', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the exercise picker' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Picked: none')).toBeInTheDocument()
  })

  it('shows the live workout sample with its timer and the PR badge', () => {
    const sample = screen.getByTestId('live-sample')

    expect(within(sample).getByRole('timer', { name: 'Sample elapsed time' })).toHaveTextContent(
      '42:17',
    )
    expect(within(sample).getByText('PR')).toBeInTheDocument()
    expect(
      within(sample).getByRole('button', { name: 'Add set to Bench Press' }),
    ).toBeInTheDocument()
  })

  it('shows the rest tone in the cards section', () => {
    expect(screen.getByTestId('card-rest-tone')).toHaveAttribute('data-tone', 'rest')
  })

  it('shows the rest timer sample in the cyan rest tone', () => {
    const sample = screen.getByTestId('live-sample')
    const rest = within(sample).getByRole('region', { name: 'Rest timer' })

    expect(rest).toHaveAttribute('data-tone', 'rest')
    expect(within(rest).getByRole('timer', { name: 'Rest remaining' })).toHaveTextContent('1:24')
  })

  it('adds 30 seconds, skips and brings back the rest timer sample', async () => {
    const sample = screen.getByTestId('live-sample')

    await userEvent.click(within(sample).getByRole('button', { name: '+30 s more rest' }))
    expect(within(sample).getByRole('timer', { name: 'Rest remaining' })).toHaveTextContent('1:54')

    await userEvent.click(within(sample).getByRole('button', { name: 'Skip rest' }))
    expect(within(sample).queryByRole('region', { name: 'Rest timer' })).not.toBeInTheDocument()

    await userEvent.click(
      within(sample).getByRole('button', { name: 'Show the rest timer sample' }),
    )
    expect(within(sample).getByRole('timer', { name: 'Rest remaining' })).toHaveTextContent('1:24')
  })

  it('changes the rest time in the rest sheet sample', async () => {
    const sample = screen.getByTestId('live-sample')
    await userEvent.click(
      within(sample).getByRole('button', { name: 'Change the rest time for Bench Press' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Rest for Bench Press' })
    await userEvent.clear(within(dialog).getByLabelText('Rest time'))
    await userEvent.type(within(dialog).getByLabelText('Rest time'), '2:00')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rest time' }))

    expect(within(sample).getByText('Bench Press rests 2:00')).toBeInTheDocument()
  })

  it('closes the rest sheet sample', async () => {
    const sample = screen.getByTestId('live-sample')
    await userEvent.click(
      within(sample).getByRole('button', { name: 'Change the rest time for Bench Press' }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Close Rest for Bench Press' }))

    expect(screen.queryByRole('dialog', { name: 'Rest for Bench Press' })).not.toBeInTheDocument()
  })

  it('mutes the rest sound on the profile sample', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Muted' }))

    expect(screen.getByRole('button', { name: 'Muted' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the edit set sample on a tap of a set row', async () => {
    const sample = screen.getByTestId('live-sample')

    await userEvent.click(within(sample).getByRole('button', { name: /^Edit set 2/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit set 2' })
    expect(within(dialog).getByRole('button', { name: 'Delete set' })).toBeInTheDocument()
  })

  it('shows the undo toast sample after a delete in the edit sheet', async () => {
    const sample = screen.getByTestId('live-sample')
    await userEvent.click(within(sample).getByRole('button', { name: /^Edit set 1/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete set' }))

    expect(await screen.findByText('Set 1 deleted.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.queryByText('Set 1 deleted.')).not.toBeInTheDocument()
  })

  it('saves the edit set sample and closes it', async () => {
    const sample = screen.getByTestId('live-sample')
    await userEvent.click(within(sample).getByRole('button', { name: /^Edit set 1/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Save set' }))

    expect(screen.queryByRole('dialog', { name: 'Edit set 1' })).not.toBeInTheDocument()
  })

  it('closes the edit set sample from its close button', async () => {
    const sample = screen.getByTestId('live-sample')
    await userEvent.click(within(sample).getByRole('button', { name: /^Edit set 1/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Close Edit set 1' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the last time line in the live workout sample', () => {
    expect(
      within(screen.getByTestId('live-sample')).getByText(/^Last time 72.5 kg × 8/),
    ).toBeInTheDocument()
  })

  it('shows the gym time offer card and hides it after Use', async () => {
    const sample = screen.getByTestId('gym-offer-sample')
    await userEvent.click(within(sample).getByRole('button', { name: 'Use 1:12:05 for gym time' }))

    expect(within(sample).queryByRole('region', { name: 'Gym time from the session' })).toBeNull()

    await userEvent.click(
      within(sample).getByRole('button', { name: 'Show the gym time offer sample' }),
    )

    expect(within(sample).getByRole('region', { name: 'Gym time from the session' })).toBeVisible()
  })

  it('opens the finish sheet sample and closes it from either choice', async () => {
    const sample = screen.getByTestId('gym-offer-sample')

    await userEvent.click(within(sample).getByRole('button', { name: 'Open the finish sheet' }))
    const sheet = await screen.findByRole('dialog', { name: 'Session finished' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Use 1:12:05 for gym time' }))
    expect(screen.queryByRole('dialog', { name: 'Session finished' })).toBeNull()

    await userEvent.click(within(sample).getByRole('button', { name: 'Open the finish sheet' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Keep 1:05:00' }))
    expect(screen.queryByRole('dialog', { name: 'Session finished' })).toBeNull()
  })
})
