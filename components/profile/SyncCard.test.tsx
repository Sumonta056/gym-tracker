import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DEAD_DAY, DEAD_PROFILE } from '../../tests/fixtures/sync'

import { deadLetterName, failedHint, SyncCard } from './SyncCard'

describe('SyncCard', () => {
  it('shows the pending count', () => {
    render(
      <SyncCard
        report={{ status: 'synced', pending: 3, failed: 0 }}
        busy={false}
        onSyncNow={vi.fn()}
      />,
    )
    expect(screen.getByText('Pending writes')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('leaves the announcing to the header chip', () => {
    render(
      <SyncCard
        report={{ status: 'synced', pending: 0, failed: 0 }}
        busy={false}
        onSyncNow={vi.fn()}
      />,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('starts a drain when Sync now is pressed', async () => {
    const onSyncNow = vi.fn()
    render(
      <SyncCard
        report={{ status: 'synced', pending: 0, failed: 0 }}
        busy={false}
        onSyncNow={onSyncNow}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(onSyncNow).toHaveBeenCalledTimes(1)
  })

  it('disables the button while a drain runs', () => {
    render(
      <SyncCard
        report={{ status: 'syncing', pending: 1, failed: 0 }}
        busy={false}
        onSyncNow={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled()
  })

  it('disables the button while its own press is in flight', () => {
    render(
      <SyncCard report={{ status: 'synced', pending: 1, failed: 0 }} busy onSyncNow={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled()
  })

  it('disables the button offline and says why', () => {
    render(
      <SyncCard
        report={{ status: 'offline', pending: 1, failed: 0 }}
        busy={false}
        onSyncNow={vi.fn()}
      />,
    )
    const button = screen.getByRole('button', { name: 'Sync now' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(
      'Offline. The writes wait on this device until the network is back.',
    )
  })

  it('shows no failed writes, and no list, while the server refused nothing', () => {
    render(
      <SyncCard
        report={{ status: 'synced', pending: 0, failed: 0 }}
        busy={false}
        onSyncNow={vi.fn()}
      />,
    )
    expect(screen.getByText('Failed writes')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Failed writes' })).not.toBeInTheDocument()
    expect(screen.queryByText(failedHint(1))).not.toBeInTheDocument()
  })

  it('shows the failed count with the Pending chip and says what the user can do', () => {
    render(
      <SyncCard
        report={{ status: 'synced', pending: 0, failed: 1 }}
        busy={false}
        onSyncNow={vi.fn()}
        deadLetters={[DEAD_DAY]}
      />,
    )
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Failed writes').nextSibling).toHaveTextContent('1')
    expect(screen.getByText(failedHint(1))).toBeInTheDocument()
  })

  it('lists every failed write with its name and the server message', () => {
    render(
      <SyncCard
        report={{ status: 'synced', pending: 0, failed: 2 }}
        busy={false}
        onSyncNow={vi.fn()}
        deadLetters={[DEAD_DAY, DEAD_PROFILE]}
      />,
    )
    const items = within(screen.getByRole('list', { name: 'Failed writes' })).getAllByRole(
      'listitem',
    )
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Tuesday 1 September')
    expect(items[0]).toHaveTextContent(DEAD_DAY.last_error ?? '')
    expect(items[1]).toHaveTextContent('Profile settings')
  })

  it('retries one failed write by its id', async () => {
    const onRetry = vi.fn()
    render(
      <SyncCard
        report={{ status: 'synced', pending: 0, failed: 1 }}
        busy={false}
        onSyncNow={vi.fn()}
        deadLetters={[DEAD_DAY]}
        onRetry={onRetry}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry Tuesday 1 September' }))
    expect(onRetry).toHaveBeenCalledWith(DEAD_DAY.id)
  })

  it('discards one failed write by its id', async () => {
    const onDiscard = vi.fn()
    render(
      <SyncCard
        report={{ status: 'synced', pending: 0, failed: 1 }}
        busy={false}
        onSyncNow={vi.fn()}
        deadLetters={[DEAD_DAY]}
        onDiscard={onDiscard}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Discard Tuesday 1 September' }))
    expect(onDiscard).toHaveBeenCalledWith(DEAD_DAY.id)
  })

  it('ignores a press when no handler is given', async () => {
    render(
      <SyncCard
        report={{ status: 'synced', pending: 0, failed: 1 }}
        busy={false}
        onSyncNow={vi.fn()}
        deadLetters={[DEAD_DAY]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry Tuesday 1 September' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard Tuesday 1 September' }))
    expect(screen.getByRole('listitem')).toBeInTheDocument()
  })

  it('reports a failed write the device could not change', () => {
    render(
      <SyncCard
        report={{ status: 'synced', pending: 0, failed: 1 }}
        busy={false}
        onSyncNow={vi.fn()}
        deadLetters={[DEAD_DAY]}
        deadLetterError="The failed write could not be changed on this device."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The failed write could not be changed on this device.',
    )
  })
})

describe('failedHint', () => {
  it('speaks of one write in the singular', () => {
    expect(failedHint(1)).toBe(
      '1 write could not reach the server. Retry sends it again. Discard keeps the data on this device only.',
    )
  })

  it('speaks of several writes in the plural', () => {
    expect(failedHint(3)).toBe(
      '3 writes could not reach the server. Retry sends them again. Discard keeps the data on this device only.',
    )
  })
})

describe('deadLetterName', () => {
  it('names a day by its weekday and date', () => {
    expect(deadLetterName(DEAD_DAY)).toBe('Tuesday 1 September')
  })

  it('names the profile write', () => {
    expect(deadLetterName(DEAD_PROFILE)).toBe('Profile settings')
  })
})
