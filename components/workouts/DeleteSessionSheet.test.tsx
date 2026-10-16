import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../lib/db/dexie'
import { SessionNotFound, SignedOutOnThisDevice } from '../../lib/db/repository'
import { BENCH, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import { DELETE_FAILED, DELETE_TITLE, DeleteSessionSheet } from './DeleteSessionSheet'
import { rowTitle } from './historyText'

import type { DeleteTarget, Discard } from './DeleteSessionSheet'

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

const SESSION = sessionOn('2026-10-16')

const TARGET: DeleteTarget = {
  session: SESSION,
  stats: { durationSeconds: 3120, setCount: 14, exerciseCount: 4, volumeKg: 3240, newRecords: [] },
}

const EMPTY_TARGET: DeleteTarget = {
  session: SESSION,
  stats: { durationSeconds: 30, setCount: 0, exerciseCount: 0, volumeKg: 0, newRecords: [] },
}

function renderSheet(target: DeleteTarget | null = TARGET, discard?: Discard) {
  const onClose = vi.fn()
  const onDeleted = vi.fn()
  render(
    <DeleteSessionSheet
      target={target}
      unit="metric"
      onClose={onClose}
      onDeleted={onDeleted}
      discard={discard}
    />,
  )
  return { onClose, onDeleted }
}

function sheet() {
  return screen.getByRole('dialog', { name: DELETE_TITLE })
}

beforeEach(async () => {
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
  ])
})

describe('DELETE_TITLE', () => {
  it('asks to delete this session', () => {
    expect(DELETE_TITLE).toBe('Delete this session?')
  })
})

describe('DeleteSessionSheet', () => {
  it('renders nothing with no target', () => {
    renderSheet(null)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the session and its numbers in the summary box', () => {
    renderSheet()
    expect(sheet()).toHaveTextContent(rowTitle(SESSION))
    expect(sheet()).toHaveTextContent('52m · 14 sets · 3,240 kg')
  })

  it('says the session and its sets go from every device', () => {
    renderSheet()
    expect(sheet()).toHaveAccessibleDescription(
      'The session and its 14 sets go from this device and from every other device after the next sync.',
    )
  })

  it('says the session alone goes when it has no set', () => {
    renderSheet(EMPTY_TARGET)
    expect(sheet()).toHaveAccessibleDescription(
      'The session goes from this device and from every other device after the next sync.',
    )
  })

  it('puts the focus on Keep it when it opens', async () => {
    renderSheet()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus()
    })
  })

  it('tints Delete session with the danger token', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Delete session' })).toHaveClass(
      'bg-danger/15',
      'text-danger',
    )
  })

  it('closes on Keep it with no discard', async () => {
    const discard = vi.fn(() => Promise.resolve())
    const { onClose } = renderSheet(TARGET, discard)
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(discard).not.toHaveBeenCalled()
  })

  it('discards the session, then reports it deleted and closes', async () => {
    const discard = vi.fn(() => Promise.resolve())
    const { onClose, onDeleted } = renderSheet(TARGET, discard)
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    expect(discard).toHaveBeenCalledWith(SESSION.id)
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks both buttons while the discard runs', async () => {
    let finish: () => void = () => undefined
    const discard = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    renderSheet(TARGET, discard)
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeDisabled()
    finish()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete session' })).toBeEnabled()
    })
  })

  it('shows the signed-out message as an alert and stays open', async () => {
    const { onClose } = renderSheet(TARGET, () => Promise.reject(new SignedOutOnThisDevice()))
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    expect(await within(sheet()).findByRole('alert')).toHaveTextContent(
      new SignedOutOnThisDevice().message,
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows a plain failure for any other error', async () => {
    renderSheet(TARGET, () => Promise.reject(new Error('blocked')))
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    expect(await within(sheet()).findByRole('alert')).toHaveTextContent(DELETE_FAILED)
  })

  it('treats a session already gone as deleted', async () => {
    const { onClose, onDeleted } = renderSheet(TARGET, () => Promise.reject(new SessionNotFound()))
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clears the error when it closes', async () => {
    const { onClose } = renderSheet(TARGET, () => Promise.reject(new Error('blocked')))
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    await within(sheet()).findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('soft-deletes the session and its sets on this device by default', async () => {
    await db.workoutSessions.put(SESSION)
    await db.workoutSets.put(liftSet(SESSION, BENCH, 10, 60))
    const { onDeleted } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1)
    })
    expect((await db.workoutSessions.get(SESSION.id))?.deleted_at).not.toBeNull()
    expect((await db.workoutSets.toArray()).every((set) => set.deleted_at !== null)).toBe(true)
  })
})
