import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readSignedInEmail, SIGN_OUT_FAILED, signOut } from '../../lib/auth/browser'
import { db } from '../../lib/db/dexie'
import {
  clearAll,
  discardDeadLetter,
  drainForSignOut,
  failedWrites,
  getProfile,
  haltSync,
  pendingWrites,
  resumeSync,
  retryDeadLetter,
  syncNow,
  updateProfile,
  upsertDay,
} from '../../lib/db/repository'
import { dailyEntrySchema } from '../../lib/schema/dailyEntry'

import {
  CLEAR_FAILED,
  DEAD_LETTER_FAILED,
  goToSignIn,
  Profile,
  READ_ERROR,
  SIGN_IN_PATH,
  UNIT_FAILED,
} from './Profile'
import { SAVE_FAILED } from './TargetsCard'

import type * as Browser from '../../lib/auth/browser'
import type * as Repository from '../../lib/db/repository'
import type { SyncOutcome } from '../../lib/db/repository'

vi.mock('../../lib/auth/browser', async (importOriginal) => {
  const actual = await importOriginal<typeof Browser>()
  return {
    ...actual,
    readSignedInEmail: vi.fn(),
    signOut: vi.fn(),
  }
})

vi.mock('../../lib/db/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof Repository>()
  return {
    ...actual,
    syncNow: vi.fn(),
    clearAll: vi.fn(actual.clearAll),
    resumeSync: vi.fn(actual.resumeSync),
    haltSync: vi.fn(actual.haltSync),
    drainForSignOut: vi.fn(),
    pendingWrites: vi.fn(actual.pendingWrites),
    failedWrites: vi.fn(actual.failedWrites),
    retryDeadLetter: vi.fn(actual.retryDeadLetter),
    discardDeadLetter: vi.fn(actual.discardDeadLetter),
    getProfile: vi.fn(actual.getProfile),
    updateProfile: vi.fn(actual.updateProfile),
  }
})

const SYNCED: SyncOutcome = { status: 'synced', pushed: 0, pulled: 0, error: null }

async function seedEveryTable(): Promise<void> {
  await upsertDay(dailyEntrySchema.parse({ entry_date: '2026-09-20', weight_kg: 73.4 }))
  await updateProfile({ target_weight_kg: 71 })
  await db.syncMeta.put({ key: 'pull_cursor_daily_entries', value: '2026-09-20T00:00:00.000Z' })
}

async function tableCounts(): Promise<number[]> {
  return Promise.all([
    db.dailyEntries.count(),
    db.profiles.count(),
    db.outbox.count(),
    db.deadLetters.count(),
    db.syncMeta.count(),
  ])
}

async function refuseFirstWrite(): Promise<string> {
  const first = await db.outbox.orderBy('sequence').first()

  if (first === undefined) {
    throw new Error('nothing is queued')
  }

  await db.deadLetters.put({
    ...first,
    attempts: 1,
    last_error: 'row level security',
    error_code: '42501',
    failed_at: '2026-09-20T10:00:00.000Z',
  })
  await db.outbox.delete(first.id)
  return first.id
}

beforeEach(async () => {
  await db.open()
  await Promise.all([
    db.dailyEntries.clear(),
    db.profiles.clear(),
    db.outbox.clear(),
    db.deadLetters.clear(),
    db.syncMeta.clear(),
  ])
  vi.mocked(readSignedInEmail).mockResolvedValue('sam@example.com')
  vi.mocked(signOut).mockResolvedValue({ status: 'signed-out' })
  vi.mocked(syncNow).mockReset()
  vi.mocked(clearAll).mockClear()
  vi.mocked(resumeSync).mockClear()
  vi.mocked(haltSync).mockClear()
  vi.mocked(pendingWrites).mockClear()
  vi.mocked(failedWrites).mockClear()
  vi.mocked(retryDeadLetter).mockClear()
  vi.mocked(discardDeadLetter).mockClear()
  vi.mocked(drainForSignOut).mockReset()
  vi.mocked(drainForSignOut).mockImplementation(() => haltSync())
  globalThis.localStorage.clear()
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
  vi.mocked(signOut).mockClear()
  vi.mocked(syncNow).mockResolvedValue(SYNCED)
})

afterEach(() => {
  resumeSync()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Profile', () => {
  it('says it is reading the device while the profile loads', () => {
    render(<Profile />)
    expect(screen.getByText('Reading this device…')).toBeInTheDocument()
  })

  it('shows the signed in email in the header', async () => {
    render(<Profile />)
    expect(await screen.findByText('sam@example.com')).toBeInTheDocument()
  })

  it('reports a profile the device cannot read', async () => {
    vi.mocked(getProfile).mockRejectedValueOnce(new Error('locked'))
    render(<Profile />)
    expect(await screen.findByRole('alert')).toHaveTextContent(READ_ERROR)
  })

  it('changes the shown weight on a unit toggle but not the stored value', async () => {
    await updateProfile({ target_weight_kg: 71 })
    render(<Profile />)
    expect(await screen.findByLabelText('Target weight (kg)')).toHaveValue('71.0')

    await userEvent.click(screen.getByRole('button', { name: 'Imperial' }))

    expect(await screen.findByLabelText('Target weight (lb)')).toHaveValue('156.5')
    expect(screen.getByText('Weight shows in pounds (lb).')).toBeInTheDocument()
    const stored = await db.profiles.toArray()
    expect(stored.map((row) => [row.unit_system, row.target_weight_kg])).toEqual([['imperial', 71]])
  })

  it('keeps the stored weight metric after a toggle and a reload', async () => {
    await updateProfile({ target_weight_kg: 71 })
    const first = render(<Profile />)
    await userEvent.click(await screen.findByRole('button', { name: 'Imperial' }))
    await screen.findByLabelText('Target weight (lb)')
    first.unmount()

    render(<Profile />)

    expect(await screen.findByLabelText('Target weight (lb)')).toHaveValue('156.5')
    expect((await db.profiles.toArray())[0]?.target_weight_kg).toBe(71)
  })

  it('stores a target typed in pounds as kilograms', async () => {
    await updateProfile({ unit_system: 'imperial' })
    render(<Profile />)
    const field = await screen.findByLabelText('Target weight (lb)')
    await userEvent.type(field, '150')
    await userEvent.tab()

    await waitFor(async () => {
      expect((await db.profiles.toArray())[0]?.target_weight_kg).toBe(68.04)
    })
  })

  it('reports a unit the device could not save', async () => {
    render(<Profile />)
    await screen.findByLabelText('Target weight (kg)')
    vi.mocked(updateProfile).mockRejectedValueOnce(new Error('locked'))

    await userEvent.click(screen.getByRole('button', { name: 'Imperial' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(UNIT_FAILED)
  })

  it('shows the pending count from useSyncStatus', async () => {
    await seedEveryTable()
    render(<Profile />)
    await screen.findByText('Pending writes')
    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  it('triggers one drain when Sync now is pressed twice fast', async () => {
    let settle: (outcome: SyncOutcome) => void = () => undefined
    vi.mocked(syncNow).mockReturnValue(
      new Promise<SyncOutcome>((resolve) => {
        settle = resolve
      }),
    )
    render(<Profile />)
    const button = await screen.findByRole('button', { name: 'Sync now' })

    act(() => {
      button.click()
      button.click()
    })

    expect(syncNow).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled()

    await act(async () => {
      settle(SYNCED)
      await Promise.resolve()
    })

    expect(await screen.findByRole('button', { name: 'Sync now' })).toBeEnabled()
  })

  it('lists a failed write, retries it, then syncs at once', async () => {
    await seedEveryTable()
    const id = await refuseFirstWrite()
    render(<Profile />)

    await userEvent.click(await screen.findByRole('button', { name: 'Retry Sunday 20 September' }))

    await waitFor(() => {
      expect(syncNow).toHaveBeenCalledTimes(1)
    })
    expect(retryDeadLetter).toHaveBeenCalledWith(id)
    expect(await db.deadLetters.count()).toBe(0)
    expect(await db.outbox.get(id)).toBeDefined()
  })

  it('discards a failed write and keeps the day on the device', async () => {
    await seedEveryTable()
    const id = await refuseFirstWrite()
    render(<Profile />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Discard Sunday 20 September' }),
    )

    await waitFor(async () => {
      expect(await db.deadLetters.count()).toBe(0)
    })
    expect(discardDeadLetter).toHaveBeenCalledWith(id)
    expect((await db.dailyEntries.toArray())[0]?.weight_kg).toBe(73.4)
  })

  it('says so when a failed write cannot be retried on this device', async () => {
    await seedEveryTable()
    await refuseFirstWrite()
    vi.mocked(retryDeadLetter).mockRejectedValueOnce(new Error('locked'))
    render(<Profile />)

    await userEvent.click(await screen.findByRole('button', { name: 'Retry Sunday 20 September' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(DEAD_LETTER_FAILED)
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('says so when a failed write cannot be discarded, and clears it on the next success', async () => {
    await seedEveryTable()
    await refuseFirstWrite()
    vi.mocked(discardDeadLetter).mockRejectedValueOnce(new Error('locked'))
    render(<Profile />)
    const discard = await screen.findByRole('button', { name: 'Discard Sunday 20 September' })

    await userEvent.click(discard)
    expect(await screen.findByRole('alert')).toHaveTextContent(DEAD_LETTER_FAILED)

    await userEvent.click(discard)
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('leaves the Phase 2 import card out while the flag is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CSV_IMPORT', '')
    render(<Profile />)
    await screen.findByLabelText('Daily step goal')
    expect(screen.queryByTestId('data-card')).not.toBeInTheDocument()
  })

  it('shows the Phase 2 import card while the flag is on', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CSV_IMPORT', '1')
    render(<Profile />)
    expect(await screen.findByTestId('data-card')).toBeInTheDocument()
  })
})

describe('sign out', () => {
  function drainEverything(): void {
    vi.mocked(drainForSignOut).mockImplementation(async () => {
      await db.outbox.clear()
      await haltSync()
    })
  }

  async function pressSignOut(): Promise<void> {
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
  }

  it('drains once, then signs out at once when no write waits', async () => {
    await seedEveryTable()
    drainEverything()
    const redirect = vi.fn()
    render(<Profile redirect={redirect} />)

    await pressSignOut()

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledTimes(1)
    })
    expect(drainForSignOut).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await tableCounts()).toEqual([0, 0, 0, 0, 0])
  })

  it('halts the worker before it counts and clears, so no drain writes rows back', async () => {
    drainEverything()
    render(<Profile redirect={vi.fn()} />)

    await pressSignOut()

    await waitFor(() => {
      expect(clearAll).toHaveBeenCalledTimes(1)
    })
    const halted = vi.mocked(drainForSignOut).mock.invocationCallOrder[0] ?? Infinity
    const counted = vi.mocked(pendingWrites).mock.invocationCallOrder[0] ?? -Infinity
    expect(halted).toBeLessThan(counted)
  })

  it('opens the confirm sheet with the count when writes still wait after the drain', async () => {
    await seedEveryTable()
    const redirect = vi.fn()
    render(<Profile redirect={redirect} />)

    await pressSignOut()

    expect(
      await screen.findByRole('dialog', { name: 'Sign out with unsynced writes?' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign out and lose 2 writes' })).toBeInTheDocument()
    expect(clearAll).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('empties every Dexie table and redirects once the loss is confirmed', async () => {
    await seedEveryTable()
    let countsAtSignOut: number[] = []
    vi.mocked(signOut).mockImplementation(async () => {
      countsAtSignOut = await tableCounts()
      return { status: 'signed-out' }
    })
    const redirect = vi.fn()
    render(<Profile redirect={redirect} />)

    await pressSignOut()
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out and lose 2 writes' }))

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledTimes(1)
    })
    expect(countsAtSignOut).toEqual([0, 0, 0, 0, 0])
    expect(await tableCounts()).toEqual([0, 0, 0, 0, 0])
  })

  it('keeps everything and resumes sync on cancel', async () => {
    await seedEveryTable()
    const before = await tableCounts()
    const redirect = vi.fn()
    render(<Profile redirect={redirect} />)

    await pressSignOut()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(resumeSync).toHaveBeenCalledTimes(1)
    expect(clearAll).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
    expect(await tableCounts()).toEqual(before)
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  })

  it('goes to the confirm sheet offline, with no manual drain', async () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true })
    await seedEveryTable()
    render(<Profile redirect={vi.fn()} />)
    await screen.findAllByText('Offline')

    await pressSignOut()

    expect(await screen.findByRole('button', { name: 'Sign out and lose 2 writes' })).toBeVisible()
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('counts the failed writes in the confirm sheet, as sign-out deletes them too', async () => {
    await seedEveryTable()
    await refuseFirstWrite()
    render(<Profile redirect={vi.fn()} />)

    await pressSignOut()

    expect(await screen.findByRole('button', { name: 'Sign out and lose 2 writes' })).toBeVisible()
    expect(failedWrites).toHaveBeenCalledTimes(1)
  })

  it('asks again with the new count when a write lands after the confirm count', async () => {
    await seedEveryTable()
    const redirect = vi.fn()
    render(<Profile redirect={redirect} />)

    await pressSignOut()
    const first = await screen.findByRole('button', { name: 'Sign out and lose 2 writes' })
    await upsertDay(dailyEntrySchema.parse({ entry_date: '2026-09-21', steps: 4000 }))
    await userEvent.click(first)

    expect(await screen.findByRole('button', { name: 'Sign out and lose 3 writes' })).toBeVisible()
    expect(redirect).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
    expect(await db.dailyEntries.count()).toBe(2)

    await userEvent.click(screen.getByRole('button', { name: 'Sign out and lose 3 writes' }))

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledTimes(1)
    })
    expect(await tableCounts()).toEqual([0, 0, 0, 0, 0])
  })

  it('asks again when another tab swaps a synced write for a new one, so the count stays the same', async () => {
    await seedEveryTable()
    const redirect = vi.fn()
    render(<Profile redirect={redirect} />)

    await pressSignOut()
    const first = await screen.findByRole('button', { name: 'Sign out and lose 2 writes' })
    const synced = await db.outbox.orderBy('sequence').first()
    await db.outbox.delete(synced?.id ?? '')
    await upsertDay(dailyEntrySchema.parse({ entry_date: '2026-09-21', steps: 4000 }))
    await userEvent.click(first)

    expect(await screen.findByRole('button', { name: 'Sign out and lose 2 writes' })).toBeVisible()
    expect(signOut).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
    expect(await db.dailyEntries.count()).toBe(2)

    await userEvent.click(screen.getByRole('button', { name: 'Sign out and lose 2 writes' }))

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledTimes(1)
    })
    expect(await tableCounts()).toEqual([0, 0, 0, 0, 0])
  })

  it('clears the failed writes with the rest of the device', async () => {
    await seedEveryTable()
    await refuseFirstWrite()
    const redirect = vi.fn()
    render(<Profile redirect={redirect} />)

    await pressSignOut()
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out and lose 2 writes' }))

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledTimes(1)
    })
    expect(await tableCounts()).toEqual([0, 0, 0, 0, 0])
  })

  it('tells the truth when the device is cleared but the sign-out fails', async () => {
    await seedEveryTable()
    drainEverything()
    vi.mocked(signOut).mockResolvedValue({ status: 'error', message: SIGN_OUT_FAILED })
    render(<Profile redirect={vi.fn()} />)

    await pressSignOut()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('comes back from the server until the sign-out succeeds')
    expect(await tableCounts()).toEqual([0, 0, 0, 0, 0])
    expect(resumeSync).toHaveBeenCalledTimes(1)
  })

  it('stays on the page and says why when the session cannot be ended', async () => {
    drainEverything()
    vi.mocked(signOut).mockResolvedValue({ status: 'error', message: 'Try again when online.' })
    const redirect = vi.fn()
    render(<Profile redirect={redirect} />)

    await pressSignOut()

    expect(await screen.findByRole('alert')).toHaveTextContent('Try again when online.')
    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  })

  it('restarts the sync worker when the session cannot be ended, as the user is still signed in', async () => {
    drainEverything()
    vi.mocked(signOut).mockResolvedValue({ status: 'error', message: 'Try again when online.' })
    render(<Profile redirect={vi.fn()} />)

    await pressSignOut()

    await screen.findByRole('alert')
    expect(resumeSync).toHaveBeenCalledTimes(1)
  })

  it('keeps the session when the device cannot be cleared', async () => {
    drainEverything()
    vi.mocked(clearAll).mockRejectedValueOnce(new Error('locked'))
    render(<Profile redirect={vi.fn()} />)

    await pressSignOut()

    expect(await screen.findByRole('alert')).toHaveTextContent(CLEAR_FAILED)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('resumes sync and keeps the session when the pending writes cannot be counted', async () => {
    vi.mocked(pendingWrites).mockRejectedValueOnce(new Error('locked'))
    render(<Profile redirect={vi.fn()} />)

    await pressSignOut()

    expect(await screen.findByRole('alert')).toHaveTextContent(CLEAR_FAILED)
    expect(resumeSync).toHaveBeenCalledTimes(1)
    expect(clearAll).not.toHaveBeenCalled()
  })

  it('resumes sync when the screen unmounts before the device is cleared', async () => {
    await seedEveryTable()
    const { unmount } = render(<Profile redirect={vi.fn()} />)

    await pressSignOut()
    await screen.findByRole('dialog')
    unmount()

    expect(resumeSync).toHaveBeenCalledTimes(1)
  })

  it('resumes sync when the screen unmounts while the sign-out drain still runs', async () => {
    await seedEveryTable()
    let release: () => void = () => undefined
    vi.mocked(drainForSignOut).mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const { unmount } = render(<Profile redirect={vi.fn()} />)

    await pressSignOut()
    unmount()
    vi.mocked(resumeSync).mockClear()
    release()

    await waitFor(() => {
      expect(resumeSync).toHaveBeenCalledTimes(1)
    })
    expect(drainForSignOut).toHaveBeenCalledTimes(1)
  })

  it('leaves sync halted when the screen unmounts after the clear', async () => {
    drainEverything()
    const redirect = vi.fn()
    const { unmount } = render(<Profile redirect={redirect} />)

    await pressSignOut()
    await waitFor(() => {
      expect(redirect).toHaveBeenCalledTimes(1)
    })
    unmount()

    expect(resumeSync).not.toHaveBeenCalled()
  })

  it('refuses a unit change while signing out, so nothing lands in a cleared device', async () => {
    await seedEveryTable()
    render(<Profile redirect={vi.fn()} />)
    await pressSignOut()
    await screen.findByRole('dialog')
    vi.mocked(updateProfile).mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Imperial' }))

    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Metric' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('refuses a target edit while signing out', async () => {
    await seedEveryTable()
    render(<Profile redirect={vi.fn()} />)
    const field = await screen.findByLabelText('Daily step goal')
    await pressSignOut()
    await screen.findByRole('dialog')
    vi.mocked(updateProfile).mockClear()

    fireEvent.change(field, { target: { value: '9000' } })
    fireEvent.blur(field)

    expect(await screen.findByText(SAVE_FAILED)).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(field).toHaveValue('9000')
  })

  it('runs one sign out when the button is pressed twice fast', async () => {
    drainEverything()
    const redirect = vi.fn()
    render(<Profile redirect={redirect} />)
    const button = await screen.findByRole('button', { name: 'Sign out' })

    act(() => {
      button.click()
      button.click()
    })

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledTimes(1)
    })
    expect(drainForSignOut).toHaveBeenCalledTimes(1)
    expect(clearAll).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})

describe('goToSignIn', () => {
  it('replaces the page with the sign in route so no old state survives', () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { replace })
    goToSignIn()
    expect(replace).toHaveBeenCalledWith(SIGN_IN_PATH)
  })
})
