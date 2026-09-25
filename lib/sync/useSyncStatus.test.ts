import 'fake-indexeddb/auto'

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../db/dexie'
import { dailyEntrySchema } from '../schema/dailyEntry'

import { moveToDeadLetters } from './deadLetters'
import { append } from './outbox'
import { toStatus, useDeadLetters, useSyncStatus } from './useSyncStatus'

import type { SyncState } from './worker'
import type { DailyEntry } from '../db/dexie'

const ROW_A = '11111111-1111-4111-8111-111111111111'

const mocks = vi.hoisted(() => ({
  getSyncState: vi.fn(),
  subscribeSyncState: vi.fn(),
}))

vi.mock('./worker', () => ({
  getSyncState: mocks.getSyncState,
  subscribeSyncState: mocks.subscribeSyncState,
}))

let notify: () => void

function entry(): DailyEntry {
  return {
    ...dailyEntrySchema.parse({ entry_date: '2026-09-01' }),
    id: ROW_A,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
  }
}

function setOnline(value: boolean): void {
  Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true })
}

beforeEach(async () => {
  mocks.getSyncState.mockReset()
  mocks.getSyncState.mockReturnValue('idle')
  mocks.subscribeSyncState.mockReset()
  mocks.subscribeSyncState.mockImplementation((listener: () => void) => {
    notify = listener

    return () => undefined
  })
  setOnline(true)
  await db.open()
  await Promise.all([db.outbox.clear(), db.deadLetters.clear(), db.syncMeta.clear()])
})

describe('useSyncStatus', () => {
  it('reports synced when the browser is online and no drain runs', async () => {
    const { result } = renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(result.current.status).toBe('synced')
    })
  })

  it('reports offline when the browser starts offline', async () => {
    setOnline(false)
    const { result } = renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(result.current.status).toBe('offline')
    })
  })

  it('reports offline as soon as the browser loses the network', async () => {
    const { result } = renderHook(() => useSyncStatus())
    await waitFor(() => {
      expect(result.current.status).toBe('synced')
    })

    setOnline(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    await waitFor(() => {
      expect(result.current.status).toBe('offline')
    })
  })

  it('reports syncing while a drain runs', async () => {
    const { result } = renderHook(() => useSyncStatus())

    mocks.getSyncState.mockReturnValue('syncing')
    act(() => {
      notify()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('syncing')
    })
  })

  it('reports error after a failed drain', async () => {
    const { result } = renderHook(() => useSyncStatus())

    mocks.getSyncState.mockReturnValue('error')
    act(() => {
      notify()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })

  it('counts the writes that still wait in the outbox', async () => {
    await append('daily_entries', 'upsert', entry())
    const { result } = renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(result.current.pending).toBe(1)
    })
  })

  it('starts at no pending writes before the count arrives', () => {
    const { result } = renderHook(() => useSyncStatus())

    expect(result.current.pending).toBe(0)
    expect(result.current.failed).toBe(0)
  })

  it('counts the writes that failed for good apart from the pending ones', async () => {
    const queued = await append('daily_entries', 'upsert', entry())
    await moveToDeadLetters(queued.id, '42501', 'rls', Date.now())
    const { result } = renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(result.current.failed).toBe(1)
    })
    expect(result.current.pending).toBe(0)
  })

  it('drops its listeners on unmount', async () => {
    const stop = vi.fn()
    mocks.subscribeSyncState.mockImplementation((listener: () => void) => {
      notify = listener

      return stop
    })

    const { unmount } = renderHook(() => useSyncStatus())
    await waitFor(() => {
      expect(mocks.subscribeSyncState).toHaveBeenCalled()
    })
    unmount()

    expect(stop).toHaveBeenCalled()
  })
})

describe('toStatus', () => {
  it('reports offline whatever the worker says when the browser is offline', () => {
    const states: SyncState[] = ['idle', 'syncing', 'synced', 'error', 'offline']

    expect(states.map((state) => toStatus(false, state))).toEqual([
      'offline',
      'offline',
      'offline',
      'offline',
      'offline',
    ])
  })

  it('maps every worker state while the browser is online', () => {
    expect(toStatus(true, 'idle')).toBe('synced')
    expect(toStatus(true, 'syncing')).toBe('syncing')
    expect(toStatus(true, 'synced')).toBe('synced')
    expect(toStatus(true, 'error')).toBe('error')
    expect(toStatus(true, 'offline')).toBe('offline')
  })
})

describe('useDeadLetters', () => {
  it('starts empty before the list arrives', () => {
    const { result } = renderHook(() => useDeadLetters())

    expect(result.current).toEqual([])
  })

  it('lists the writes that failed for good', async () => {
    const queued = await append('daily_entries', 'upsert', entry())
    await moveToDeadLetters(queued.id, '42501', 'rls', Date.now())
    const { result } = renderHook(() => useDeadLetters())

    await waitFor(() => {
      expect(result.current.map((letter) => letter.id)).toEqual([queued.id])
    })
  })
})
