import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getProfile, listRange, listSessions } from '../../lib/db/repository'
import { entryOn, NOW, PROFILE, TODAY } from '../../tests/fixtures/dashboard'

import { entriesIn, READ_ERROR, useAnalytics } from './useAnalytics'

vi.mock('../../lib/db/repository', async () => {
  const { PROFILE } = await import('../../tests/fixtures/dashboard')
  return {
    listRange: vi.fn(),
    listSessions: vi.fn(() => Promise.resolve([])),
    getProfile: vi.fn(() => Promise.resolve({ ...PROFILE, step_goal: 10000 })),
  }
})

const clock = () => NOW

beforeEach(() => {
  vi.mocked(listRange).mockReset()
  vi.mocked(listRange).mockResolvedValue([])
  vi.mocked(getProfile).mockClear()
  vi.mocked(listSessions).mockClear()
})

describe('useAnalytics', () => {
  it('starts in the loading state', () => {
    const { result } = renderHook(() => useAnalytics('week', clock))
    expect(result.current.status).toBe('loading')
  })

  it('reads the whole history once, with no range read', async () => {
    renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(listRange).toHaveBeenCalledTimes(1)
    })
    expect(listRange).toHaveBeenCalledWith('0000-01-01', '9999-12-31')
  })

  it('reads the sessions of the whole history once', async () => {
    const { rerender } = renderHook(({ tab }) => useAnalytics(tab, clock), {
      initialProps: { tab: 'week' as 'week' | 'month' },
    })
    await waitFor(() => {
      expect(listSessions).toHaveBeenCalledWith('0000-01-01', '9999-12-31')
    })
    rerender({ tab: 'month' })
    expect(listSessions).toHaveBeenCalledTimes(1)
  })

  it('keeps the data ready through a tab switch, with no second read', async () => {
    vi.mocked(listRange).mockResolvedValue([entryOn('2026-09-21'), entryOn(TODAY)])
    const { result, rerender } = renderHook(({ tab }) => useAnalytics(tab, clock), {
      initialProps: { tab: 'week' as 'week' | 'month' },
    })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    rerender({ tab: 'month' })
    expect(result.current.status === 'ready' && result.current.data.tab).toBe('month')
    expect(listRange).toHaveBeenCalledTimes(1)
    expect(getProfile).toHaveBeenCalledTimes(1)
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

  it('carries the unit system from the profile so the weight chart can follow it', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce({ ...PROFILE, unit_system: 'imperial' })
    const { result } = renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(result.current.status === 'ready' && result.current.data.unitSystem).toBe('imperial')
    })
  })

  it('hands the profile goals to the data', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce({
      ...PROFILE,
      calorie_goal: 800,
      target_weight_kg: 72,
    })
    const { result } = renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current.status === 'ready' && result.current.data.goals).toEqual({
      calories: 800,
      gymSeconds: null,
      walkSeconds: null,
      weightKg: 72,
    })
  })

  it('hands the max heart rate of the profile to the data', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce({ ...PROFILE, birth_year: 1996 })
    const { result } = renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current.status === 'ready' && result.current.data.maxHeartRate).toEqual({
      bpm: 190,
      source: 'age',
    })
  })

  it('hands no max heart rate for a profile with neither field', async () => {
    const { result } = renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current.status === 'ready' && result.current.data.maxHeartRate).toBeNull()
  })

  it('reports a read that fails', async () => {
    vi.mocked(listRange).mockRejectedValue(new Error('locked'))
    const { result } = renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'error', message: READ_ERROR })
    })
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
      expect(listRange).toHaveBeenCalledTimes(1)
    })
  })
})

describe('entriesIn', () => {
  it('keeps the rows from six days before the week to its Sunday', () => {
    const history = ['2026-09-14', '2026-09-15', TODAY, '2026-09-27', '2026-09-28'].map((date) =>
      entryOn(date),
    )
    expect(entriesIn(history, 'week', TODAY).map((row) => row.entry_date)).toEqual([
      '2026-09-15',
      TODAY,
      '2026-09-27',
    ])
  })

  it('returns no row for an empty history', () => {
    expect(entriesIn([], 'month', TODAY)).toEqual([])
  })
})
