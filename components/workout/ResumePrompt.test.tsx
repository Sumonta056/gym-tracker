import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../lib/db/dexie'
import {
  addSet,
  getActiveSession,
  listSets,
  SignedOutOnThisDevice,
  startSession,
} from '../../lib/db/repository'

import {
  CONFIRM_TITLE,
  DISCARD_FAILED,
  discardText,
  reloadPage,
  REPOSITORY_RESUME_SOURCE,
  RESUME_TITLE,
  ResumePrompt,
  WORKOUT_PATH,
} from './ResumePrompt'
import { startedText } from './SessionTimer'

import type { ResumeSource } from './ResumePrompt'
import type { WorkoutSession } from '../../lib/db/dexie'

const navigation = vi.hoisted(() => ({ pathname: '/' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

const BENCH_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(async () => {
  navigation.pathname = '/'
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
  ])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function runningSession(sets = 0): Promise<WorkoutSession> {
  const session = await startSession('2026-09-01')

  for (let index = 0; index < sets; index += 1) {
    await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 8, weight_kg: 60 })
  }

  return session
}

function renderPrompt(props: Parameters<typeof ResumePrompt>[0] = {}) {
  const onDiscarded = vi.fn()
  const view = render(<ResumePrompt onDiscarded={onDiscarded} {...props} />)
  return { ...view, onDiscarded }
}

async function prompt() {
  return screen.findByRole('dialog', { name: RESUME_TITLE })
}

describe('discardText', () => {
  it('counts the sets that go with the session', () => {
    expect(discardText(3)).toBe(
      'The session and its 3 sets are removed from every device. This cannot be undone.',
    )
  })

  it('uses the singular for one set', () => {
    expect(discardText(1)).toContain('its 1 set are')
  })
})

describe('ResumePrompt', () => {
  it('offers Resume and Discard when the app opens with an active session', async () => {
    const session = await runningSession()
    renderPrompt()

    const dialog = await prompt()
    expect(dialog).toHaveTextContent(
      `A session started at ${startedText(session.started_at)} is still running on this device.`,
    )
    expect(within(dialog).getByRole('link', { name: 'Resume' })).toHaveAttribute(
      'href',
      WORKOUT_PATH,
    )
    expect(within(dialog).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
  })

  it('shows nothing when no session is running', async () => {
    const getActive = vi.fn(() => Promise.resolve(undefined))
    renderPrompt({ source: { ...REPOSITORY_RESUME_SOURCE, getActiveSession: getActive } })

    await waitFor(() => {
      expect(getActive).toHaveBeenCalled()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not ask on the live screen, which already shows the session', async () => {
    await runningSession()
    navigation.pathname = WORKOUT_PATH
    const getActive = vi.fn(getActiveSession)
    renderPrompt({ source: { ...REPOSITORY_RESUME_SOURCE, getActiveSession: getActive } })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(getActive).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks only when the app opens, not again on a move to another screen', async () => {
    await runningSession()
    const source = { ...REPOSITORY_RESUME_SOURCE, getActiveSession: vi.fn(getActiveSession) }
    const { rerender } = renderPrompt({ source })
    await prompt()
    await userEvent.click(screen.getByRole('button', { name: `Close ${RESUME_TITLE}` }))

    navigation.pathname = '/log'
    rerender(<ResumePrompt source={source} />)

    expect(source.getActiveSession).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Resume and keeps the session', async () => {
    const session = await runningSession()
    renderPrompt()

    await userEvent.click(within(await prompt()).getByRole('link', { name: 'Resume' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await getActiveSession())?.id).toBe(session.id)
  })

  it('asks once more before Discard, and names the sets that go', async () => {
    await runningSession(2)
    renderPrompt()

    await userEvent.click(within(await prompt()).getByRole('button', { name: 'Discard' }))

    const confirm = screen.getByRole('dialog', { name: CONFIRM_TITLE })
    expect(confirm).toHaveTextContent(discardText(2))
    expect(await getActiveSession()).toBeDefined()
  })

  it('puts the focus on the safe choice when it asks once more', async () => {
    await runningSession()
    renderPrompt()

    await userEvent.click(within(await prompt()).getByRole('button', { name: 'Discard' }))

    expect(screen.getByRole('button', { name: 'Keep the session' })).toHaveFocus()
  })

  it('goes back to the first question on Keep the session', async () => {
    await runningSession()
    renderPrompt()

    await userEvent.click(within(await prompt()).getByRole('button', { name: 'Discard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Keep the session' }))

    expect(screen.getByRole('dialog', { name: RESUME_TITLE })).toBeInTheDocument()
    expect(await getActiveSession()).toBeDefined()
  })

  it('soft deletes the session and its sets on the second Discard', async () => {
    const session = await runningSession(2)
    const { onDiscarded } = renderPrompt()

    await userEvent.click(within(await prompt()).getByRole('button', { name: 'Discard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard session' }))

    await waitFor(() => {
      expect(onDiscarded).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await getActiveSession()).toBeUndefined()
    expect((await db.workoutSessions.get(session.id))?.deleted_at).not.toBeNull()
    expect(await listSets(session.id)).toEqual([])
    const stored = await db.workoutSets.where('session_id').equals(session.id).toArray()
    expect(stored).toHaveLength(2)
    expect(stored.every((set) => set.deleted_at !== null)).toBe(true)
  })

  it('says so and stays open when the discard fails', async () => {
    const session = await runningSession()
    const source: ResumeSource = {
      ...REPOSITORY_RESUME_SOURCE,
      discardSession: () => Promise.reject(new Error('the disk is full')),
    }
    const { onDiscarded } = renderPrompt({ source })

    await userEvent.click(within(await prompt()).getByRole('button', { name: 'Discard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(DISCARD_FAILED)
    expect(screen.getByRole('dialog', { name: CONFIRM_TITLE })).toBeInTheDocument()
    expect(onDiscarded).not.toHaveBeenCalled()
    expect((await getActiveSession())?.id).toBe(session.id)
  })

  it('names a signed-out device when the discard is refused', async () => {
    await runningSession()
    const source: ResumeSource = {
      ...REPOSITORY_RESUME_SOURCE,
      discardSession: () => Promise.reject(new SignedOutOnThisDevice()),
    }
    renderPrompt({ source })

    await userEvent.click(within(await prompt()).getByRole('button', { name: 'Discard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(new SignedOutOnThisDevice().message)
  })

  it('clears the failure when the user goes back', async () => {
    await runningSession()
    const source: ResumeSource = {
      ...REPOSITORY_RESUME_SOURCE,
      discardSession: () => Promise.reject(new Error('the disk is full')),
    }
    renderPrompt({ source })

    await userEvent.click(within(await prompt()).getByRole('button', { name: 'Discard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard session' }))
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Keep the session' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('stays open while the discard runs', async () => {
    await runningSession()
    let finish: () => void = () => undefined
    const source: ResumeSource = {
      ...REPOSITORY_RESUME_SOURCE,
      discardSession: () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    }
    renderPrompt({ source })

    await userEvent.click(within(await prompt()).getByRole('button', { name: 'Discard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard session' }))
    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: CONFIRM_TITLE })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard session' })).toBeDisabled()
    finish()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows nothing when the session cannot be read', async () => {
    const getActive = vi.fn(() => Promise.reject(new Error('blocked')))
    renderPrompt({ source: { ...REPOSITORY_RESUME_SOURCE, getActiveSession: getActive } })

    await waitFor(() => {
      expect(getActive).toHaveBeenCalled()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows nothing when it goes away before the read ends', async () => {
    await runningSession()
    const { unmount } = renderPrompt()

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('reloadPage', () => {
  it('reloads the page, so every screen reads the discard', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })

    reloadPage()

    expect(reload).toHaveBeenCalledTimes(1)
  })
})
