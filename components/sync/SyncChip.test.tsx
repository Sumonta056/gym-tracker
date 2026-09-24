import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSyncStatus } from '../../lib/db/repository'

import { chipStatus, SyncChip, SyncChipView } from './SyncChip'

vi.mock('../../lib/db/repository', () => ({
  useSyncStatus: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useSyncStatus).mockReturnValue({ status: 'synced', pending: 0, failed: 0 })
})

describe('chipStatus', () => {
  it('reports offline whenever the device is offline', () => {
    expect(chipStatus({ status: 'offline', pending: 3, failed: 0 })).toBe('offline')
  })

  it('reports syncing while a drain runs', () => {
    expect(chipStatus({ status: 'syncing', pending: 1, failed: 0 })).toBe('syncing')
  })

  it('reports synced only when nothing waits in the outbox', () => {
    expect(chipStatus({ status: 'synced', pending: 0, failed: 0 })).toBe('synced')
  })

  it('reports pending when a write still waits, even after a clean drain', () => {
    expect(chipStatus({ status: 'synced', pending: 2, failed: 0 })).toBe('pending')
  })

  it('reports pending while a write the server refused waits, even with an empty outbox', () => {
    expect(chipStatus({ status: 'synced', pending: 0, failed: 1 })).toBe('pending')
  })

  it('reports pending after a failed drain', () => {
    expect(chipStatus({ status: 'error', pending: 0, failed: 0 })).toBe('pending')
  })
})

describe('SyncChipView', () => {
  it('names the state in words', () => {
    render(<SyncChipView report={{ status: 'syncing', pending: 1, failed: 0 }} />)
    expect(screen.getByRole('status')).toHaveTextContent('SYNCING')
  })
})

describe('SyncChip', () => {
  it('reads the status the repository re-exports', () => {
    vi.mocked(useSyncStatus).mockReturnValue({ status: 'offline', pending: 0, failed: 0 })
    render(<SyncChip />)
    expect(screen.getByRole('status')).toHaveTextContent('OFFLINE')
  })

  it('shows synced when the outbox is empty and the last drain passed', () => {
    render(<SyncChip />)
    expect(screen.getByRole('status')).toHaveTextContent('SYNCED')
  })
})
