import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listExercises, listSessions, listSetsInRange } from '../../lib/db/repository'
import { EXERCISES, liftSet, sessionOn, BENCH } from '../../tests/fixtures/lifts'

import { HISTORY_END, LIFT_READ_ERROR, useLiftData } from './useLiftData'

vi.mock('../../lib/db/repository', () => ({
  listSessions: vi.fn(),
  listSetsInRange: vi.fn(),
  listExercises: vi.fn(),
}))

const session = sessionOn('2026-09-21')
const set = liftSet(session, BENCH, 8, 45)

beforeEach(() => {
  vi.mocked(listSessions).mockReset().mockResolvedValue([session])
  vi.mocked(listSetsInRange).mockReset().mockResolvedValue([set])
  vi.mocked(listExercises).mockReset().mockResolvedValue(EXERCISES)
})

describe('useLiftData', () => {
  it('starts in the loading state', () => {
    const { result } = renderHook(() => useLiftData())
    expect(result.current).toEqual({ status: 'loading' })
  })

  it('reads every session, every set and every exercise, archived ones too', async () => {
    const { result } = renderHook(() => useLiftData())

    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'ready',
        source: { sessions: [session], sets: [set], exercises: EXERCISES },
      })
    })
    expect(listSessions).toHaveBeenCalledWith('0000-01-01', HISTORY_END)
    expect(listSetsInRange).toHaveBeenCalledWith('0000-01-01', HISTORY_END)
    expect(listExercises).toHaveBeenCalledWith({ includeArchived: true })
  })

  it('reports the error when a read fails', async () => {
    vi.mocked(listSetsInRange).mockRejectedValue(new Error('locked'))
    const { result } = renderHook(() => useLiftData())

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'error', message: LIFT_READ_ERROR })
    })
  })

  it('sets no state after it unmounts', async () => {
    let finish: (value: typeof EXERCISES) => void = () => undefined
    vi.mocked(listExercises).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { result, unmount } = renderHook(() => useLiftData())
    unmount()
    finish(EXERCISES)
    await Promise.resolve()

    expect(result.current).toEqual({ status: 'loading' })
  })

  it('sets no error after it unmounts', async () => {
    let fail: (cause: Error) => void = () => undefined
    vi.mocked(listExercises).mockReturnValue(
      new Promise((_, reject) => {
        fail = reject
      }),
    )
    const { result, unmount } = renderHook(() => useLiftData())
    unmount()
    fail(new Error('locked'))
    await Promise.resolve()

    expect(result.current).toEqual({ status: 'loading' })
  })
})
