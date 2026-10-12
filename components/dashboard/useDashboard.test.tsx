import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getProfile,
  listRange,
  listSessions,
  listSetsInRange,
  setsForExercises,
} from '../../lib/db/repository'
import { entryOn, NOW, PROFILE, TODAY } from '../../tests/fixtures/dashboard'
import { BENCH, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import { HISTORY_START } from './summary'
import { READ_ERROR, useDashboard } from './useDashboard'

vi.mock('../../lib/db/repository', () => ({
  getProfile: vi.fn(),
  listRange: vi.fn(),
  listSessions: vi.fn(),
  listSetsInRange: vi.fn(),
  setsForExercises: vi.fn(),
}))

const clock = () => NOW

beforeEach(() => {
  vi.mocked(listRange).mockResolvedValue([entryOn(TODAY)])
  vi.mocked(getProfile).mockResolvedValue(PROFILE)
  vi.mocked(listSessions).mockResolvedValue([])
  vi.mocked(listSetsInRange).mockResolvedValue([])
  vi.mocked(setsForExercises).mockResolvedValue([])
})

describe('useDashboard', () => {
  it('starts in the loading state', () => {
    const { result } = renderHook(() => useDashboard(clock))
    expect(result.current.status).toBe('loading')
  })

  it('reads every entry up to today through the repository', async () => {
    renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(listRange).toHaveBeenCalledWith(HISTORY_START, TODAY)
    })
  })

  it('reads the sessions of the current week up to today', async () => {
    renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(listSessions).toHaveBeenCalledWith('2026-09-21', TODAY)
    })
  })

  it('reads the sets of today only', async () => {
    renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(listSetsInRange).toHaveBeenCalledWith(TODAY, TODAY)
    })
  })

  it('reads the earlier sets of the exercises done today', async () => {
    const session = sessionOn(TODAY)
    vi.mocked(listSessions).mockResolvedValue([session])
    vi.mocked(listSetsInRange).mockResolvedValue([
      liftSet(session, BENCH, 10, 60),
      liftSet(session, BENCH, 8, 65),
    ])
    renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(setsForExercises).toHaveBeenCalledWith([BENCH])
    })
  })

  it('builds the summary with the workouts of today', async () => {
    const session = sessionOn(TODAY)
    vi.mocked(listSessions).mockResolvedValue([session])
    const { result } = renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(
      result.current.status === 'ready' &&
        result.current.summary.workouts.map((row) => row.session.id),
    ).toEqual([session.id])
  })

  it('reports a failed session read in words', async () => {
    vi.mocked(listSessions).mockRejectedValue(new Error('blocked'))
    const { result } = renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'error', message: READ_ERROR })
    })
  })

  it('becomes ready with the summary for today', async () => {
    const { result } = renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current.status === 'ready' && result.current.summary.today).toBe(TODAY)
  })

  it('reports a read failure in words', async () => {
    vi.mocked(listRange).mockRejectedValue(new Error('blocked'))
    const { result } = renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'error', message: READ_ERROR })
    })
  })

  it('drops a read that lands after unmount', async () => {
    let finish: (value: never[]) => void = () => undefined
    vi.mocked(listRange).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { result, unmount } = renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(listRange).toHaveBeenCalled()
    })
    unmount()
    finish([])
    await Promise.resolve()
    expect(result.current.status).toBe('loading')
  })

  it('drops a failure that lands after unmount', async () => {
    let fail: (reason: Error) => void = () => undefined
    vi.mocked(listRange).mockReturnValue(
      new Promise((_, reject) => {
        fail = reject
      }),
    )
    const { result, unmount } = renderHook(() => useDashboard(clock))
    await waitFor(() => {
      expect(listRange).toHaveBeenCalled()
    })
    unmount()
    fail(new Error('late'))
    await Promise.resolve()
    expect(result.current.status).toBe('loading')
  })

  it('uses the system clock when none is given', async () => {
    const { result } = renderHook(() => useDashboard())
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
  })
})
