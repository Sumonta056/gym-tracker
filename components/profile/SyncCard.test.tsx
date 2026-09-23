import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SyncCard } from './SyncCard'

describe('SyncCard', () => {
  it('shows the pending count', () => {
    render(<SyncCard report={{ status: 'synced', pending: 3 }} busy={false} onSyncNow={vi.fn()} />)
    expect(screen.getByText('Pending writes')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('leaves the announcing to the header chip', () => {
    render(<SyncCard report={{ status: 'synced', pending: 0 }} busy={false} onSyncNow={vi.fn()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('starts a drain when Sync now is pressed', async () => {
    const onSyncNow = vi.fn()
    render(
      <SyncCard report={{ status: 'synced', pending: 0 }} busy={false} onSyncNow={onSyncNow} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(onSyncNow).toHaveBeenCalledTimes(1)
  })

  it('disables the button while a drain runs', () => {
    render(<SyncCard report={{ status: 'syncing', pending: 1 }} busy={false} onSyncNow={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled()
  })

  it('disables the button while its own press is in flight', () => {
    render(<SyncCard report={{ status: 'synced', pending: 1 }} busy onSyncNow={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled()
  })

  it('disables the button offline and says why', () => {
    render(<SyncCard report={{ status: 'offline', pending: 1 }} busy={false} onSyncNow={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Sync now' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(
      'Offline. The writes wait on this device until the network is back.',
    )
  })
})
