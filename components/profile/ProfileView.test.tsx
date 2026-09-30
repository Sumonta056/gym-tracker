import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PROFILE } from '../../tests/fixtures/dashboard'
import { DEAD_DAY } from '../../tests/fixtures/sync'

import { MANAGE_TITLE } from './ManageExercisesSheet'
import { ProfileView, signOutHint } from './ProfileView'

import type { ManageExerciseSource } from './ManageExercisesSheet'
import type { ProfileViewProps } from './ProfileView'
import type { Exercise } from '../../lib/db/dexie'

const OWN_FLY: Exercise = {
  id: '55555555-5555-4555-8555-555555555555',
  user_id: 'local',
  name: 'Cable Fly',
  muscle_group: 'chest',
  is_archived: false,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
}

function exerciseSource(): ManageExerciseSource {
  return {
    listExercises: vi.fn(() => Promise.resolve([OWN_FLY])),
    renameExercise: vi.fn(() => Promise.resolve(OWN_FLY)),
    archiveExercise: vi.fn(() => Promise.resolve()),
    restoreExercise: vi.fn(() => Promise.resolve()),
  }
}

function renderView(overrides: Partial<ProfileViewProps> = {}) {
  const props: ProfileViewProps = {
    email: 'sam@example.com',
    profile: PROFILE,
    report: { status: 'synced', pending: 0, failed: 0 },
    showImport: false,
    syncBusy: false,
    signingOut: false,
    signOutError: null,
    onUnitChange: vi.fn(),
    onSaveTarget: vi.fn(() => Promise.resolve()),
    onSyncNow: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  }
  render(<ProfileView {...props} />)
  return props
}

describe('ProfileView', () => {
  it('lays the cards out in one, two, then three columns', () => {
    renderView()
    expect(screen.getByTestId('profile-grid')).toHaveClass(
      'grid-cols-1',
      'md:grid-cols-2',
      'lg:grid-cols-3',
    )
  })

  it('leaves the Phase 2 import card out of the document while the flag is off', () => {
    renderView()
    expect(screen.queryByTestId('data-card')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Import the Excel CSV' })).not.toBeInTheDocument()
  })

  it('shows the import card while the flag is on', () => {
    renderView({ showImport: true })
    expect(screen.getByTestId('data-card')).toBeInTheDocument()
  })

  it('shows the rest sound setting and hands a change to its owner', async () => {
    const props = renderView({ onMutedChange: vi.fn() })
    expect(screen.getByRole('group', { name: 'Rest sound' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Muted' }))

    expect(props.onMutedChange).toHaveBeenCalledWith(true)
  })

  it('shows a rest sound error the owner reports', () => {
    renderView({ soundError: 'Not saved.' })
    expect(within(screen.getByTestId('rest-sound-card')).getByRole('alert')).toHaveTextContent(
      'Not saved.',
    )
  })

  it('shows the units, the targets and the sync cards', () => {
    renderView()
    expect(screen.getByRole('group', { name: 'Unit system' })).toBeInTheDocument()
    expect(screen.getByLabelText('Daily step goal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeInTheDocument()
  })

  it('signs out through a destructive button', async () => {
    const props = renderView()
    const button = screen.getByRole('button', { name: 'Sign out' })
    expect(button).toHaveClass('text-danger')
    await userEvent.click(button)
    expect(props.onSignOut).toHaveBeenCalledTimes(1)
  })

  it('disables sign out while it runs', () => {
    renderView({ signingOut: true })
    expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled()
  })

  it('ties a sign out failure to the button', () => {
    renderView({ signOutError: 'Try again when online.' })
    const button = screen.getByRole('button', { name: 'Sign out' })
    expect(button).toHaveAccessibleDescription(
      'Signing out clears every entry on this device. Try again when online.',
    )
    expect(within(screen.getByTestId('profile-grid')).getByRole('alert')).toHaveTextContent(
      'Try again when online.',
    )
  })

  it('warns that pending writes are lost on sign out, tied to the button', () => {
    renderView({ report: { status: 'synced', pending: 2, failed: 0 } })
    const warning = '2 writes have not reached the server yet. Signing out now loses them.'
    expect(screen.getByText(warning)).toHaveClass('text-warn')
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveAccessibleDescription(warning)
  })

  it('counts the failed writes in the sign-out warning, as sign-out deletes them too', () => {
    renderView({ report: { status: 'synced', pending: 1, failed: 1 } })
    expect(
      screen.getByText('2 writes have not reached the server yet. Signing out now loses them.'),
    ).toHaveClass('text-warn')
  })

  it('hands the failed writes and their actions to the sync card', async () => {
    const onRetryDeadLetter = vi.fn()
    const onDiscardDeadLetter = vi.fn()
    renderView({
      report: { status: 'synced', pending: 0, failed: 1 },
      deadLetters: [DEAD_DAY],
      onRetryDeadLetter,
      onDiscardDeadLetter,
      deadLetterError: 'Not moved.',
    })
    await userEvent.click(screen.getByRole('button', { name: 'Retry Tuesday 1 September' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard Tuesday 1 September' }))
    expect(onRetryDeadLetter).toHaveBeenCalledWith(DEAD_DAY.id)
    expect(onDiscardDeadLetter).toHaveBeenCalledWith(DEAD_DAY.id)
    expect(screen.getByRole('alert')).toHaveTextContent('Not moved.')
  })

  it('announces the sync state once, from the header chip', () => {
    renderView()
    const chips = screen.getAllByRole('status').filter((node) => node.textContent === 'Synced')
    expect(chips).toHaveLength(1)
  })

  it('passes a unit error to the units card', () => {
    renderView({ unitError: 'Not saved.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved.')
  })
})

describe('ProfileView manage exercises', () => {
  it('shows the manage exercises row whether or not the import flag is on', () => {
    renderView({ exerciseSource: exerciseSource() })
    const card = screen.getByTestId('exercises-card')
    expect(within(card).getByRole('button', { name: 'Manage exercises' })).toHaveClass('min-h-11')
  })

  it('opens the manage exercises sheet from the row', async () => {
    renderView({ exerciseSource: exerciseSource() })
    await userEvent.click(screen.getByRole('button', { name: 'Manage exercises' }))
    const dialog = screen.getByRole('dialog', { name: MANAGE_TITLE })
    expect(await within(dialog).findByRole('button', { name: 'Rename Cable Fly' })).toBeVisible()
  })

  it('closes the sheet and returns focus to the row', async () => {
    renderView({ exerciseSource: exerciseSource() })
    const row = screen.getByRole('button', { name: 'Manage exercises' })
    await userEvent.click(row)
    await userEvent.click(screen.getByRole('button', { name: `Close ${MANAGE_TITLE}` }))
    expect(screen.queryByRole('dialog', { name: MANAGE_TITLE })).not.toBeInTheDocument()
    expect(row).toHaveFocus()
  })
})

describe('ProfileView sign-out sheet', () => {
  it('opens the confirm sheet with the count it is given', () => {
    renderView({ lostOnSignOut: 2 })
    expect(screen.getByRole('dialog', { name: 'Sign out with unsynced writes?' })).toBeVisible()
  })

  it('hands the confirm and the cancel to its owner', async () => {
    const onConfirmSignOut = vi.fn()
    const onCancelSignOut = vi.fn()
    renderView({ lostOnSignOut: 2, onConfirmSignOut, onCancelSignOut })
    await userEvent.click(screen.getByRole('button', { name: 'Sign out and lose 2 writes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirmSignOut).toHaveBeenCalledTimes(1)
    expect(onCancelSignOut).toHaveBeenCalledTimes(1)
  })

  it('does nothing on confirm or cancel when no owner handles them', async () => {
    const props = renderView({ lostOnSignOut: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Sign out and lose 1 write' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onSignOut).not.toHaveBeenCalled()
  })
})

describe('signOutHint', () => {
  it('says the device is cleared when nothing is pending', () => {
    expect(signOutHint(0)).toBe('Signing out clears every entry on this device.')
  })

  it('names a single pending write', () => {
    expect(signOutHint(1)).toBe(
      '1 write has not reached the server yet. Signing out now loses them.',
    )
  })
})
