import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listRange } from '../../lib/db/repository'
import { entryOn, NOW } from '../../tests/fixtures/dashboard'

import { READ_ERROR, useAnalytics } from './useAnalytics'

vi.mock('../../lib/db/repository', async () => {
  const { PROFILE } = await import('../../tests/fixtures/dashboard')
  return {
    listRange: vi.fn(),
    getProfile: vi.fn(() => Promise.resolve({ ...PROFILE, step_goal: 10000 })),
  }
})

const clock = () => NOW

beforeEach(() => {
  vi.mocked(listRange).mockReset()
  vi.mocked(listRange).mockResolvedValue([])
})

describe('useAnalytics', () => {
  it('starts in the loading state', () => {
    const { result } = renderHook(() => useAnalytics('week', clock))
    expect(result.current.status).toBe('loading')
  })

  it('reads the week, with six days before it, and the whole history', async () => {
    renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(listRange).toHaveBeenCalledWith('2026-09-15', '2026-09-27')
    })
    expect(listRange).toHaveBeenCalledWith('0000-01-01', '2026-09-23')
  })

  it('settles with the analysed data', async () => {
    vi.mocked(listRange).mockResolvedValue([entryOn('2026-09-23')])
    const { result } = renderHook(() => useAnalytics('day', clock))
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current.status === 'ready' && result.current.data.streak.current).toBe(1)
  })

  it('reads the daily step goal from the profile through the repository', async () => {
    const { result } = renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(result.current.status === 'ready' && result.current.data.stepGoal).toBe(10000)
    })
  })

  it('reports a read that fails', async () => {
    vi.mocked(listRange).mockRejectedValue(new Error('locked'))
    const { result } = renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'error', message: READ_ERROR })
    })
  })

  it('goes back to loading while a new range is read', async () => {
    const { result, rerender } = renderHook(({ tab }) => useAnalytics(tab, clock), {
      initialProps: { tab: 'week' as 'week' | 'month' },
    })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    vi.mocked(listRange).mockReturnValue(new Promise(() => undefined))
    rerender({ tab: 'month' })
    expect(result.current.status).toBe('loading')
  })

  it('ignores a read that settles after unmount', async () => {
    let resolve: (value: []) => void = () => undefined
    vi.mocked(listRange).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const { result, unmount } = renderHook(() => useAnalytics('week', clock))
    unmount()
    resolve([])
    await Promise.resolve()
    expect(result.current.status).toBe('loading')
  })

  it('ignores a failure that settles after unmount', async () => {
    let reject: (reason: Error) => void = () => undefined
    vi.mocked(listRange).mockReturnValue(
      new Promise((_, fail) => {
        reject = fail
      }),
    )
    const { result, unmount } = renderHook(() => useAnalytics('week', clock))
    unmount()
    reject(new Error('late'))
    await Promise.resolve()
    expect(result.current.status).toBe('loading')
  })

  it('uses the system clock when none is given', async () => {
    renderHook(() => useAnalytics('day'))
    await waitFor(() => {
      expect(listRange).toHaveBeenCalledTimes(2)
    })
  })
})
