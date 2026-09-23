import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getProfile, listRange } from '../../lib/db/repository'
import { entryOn, NOW, PROFILE, TODAY } from '../../tests/fixtures/dashboard'

import { HISTORY_START } from './summary'
import { READ_ERROR, useDashboard } from './useDashboard'

vi.mock('../../lib/db/repository', () => ({
  getProfile: vi.fn(),
  listRange: vi.fn(),
}))

const clock = () => NOW

beforeEach(() => {
  vi.mocked(listRange).mockResolvedValue([entryOn(TODAY)])
  vi.mocked(getProfile).mockResolvedValue(PROFILE)
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
