import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { startSync } from '../../lib/db/repository'

import AppLayout from './layout'

const mocks = vi.hoisted(() => ({
  stop: vi.fn(),
  active: undefined as
    | undefined
    | {
        id: string
        started_at: string
      },
}))

vi.mock('../../lib/db/repository', () => ({
  startSync: vi.fn(() => mocks.stop),
  getActiveSession: vi.fn(() => Promise.resolve(mocks.active)),
  listSets: vi.fn(() => Promise.resolve([])),
  discardSession: vi.fn(() => Promise.resolve()),
  SignedOutOnThisDevice: class extends Error {},
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

function setup() {
  render(
    <AppLayout>
      <p>Signed in content</p>
    </AppLayout>,
  )
}

describe('AppLayout', () => {
  it('renders its children inside the main landmark', () => {
    setup()
    expect(screen.getByRole('main')).toHaveTextContent('Signed in content')
  })

  it('starts the sync worker for the signed-in app and stops it on unmount', () => {
    vi.mocked(startSync).mockClear()
    const { unmount } = render(
      <AppLayout>
        <p>Signed in content</p>
      </AppLayout>,
    )
    expect(startSync).toHaveBeenCalledTimes(1)
    unmount()
    expect(mocks.stop).toHaveBeenCalledTimes(1)
  })

  it('carries both navigations, so every signed-in route sits in one shell', () => {
    setup()
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Bottom navigation' })).toBeInTheDocument()
  })

  it('asks to resume a session still running when the app opens', async () => {
    mocks.active = { id: 'session-1', started_at: '2026-09-01T17:30:00.000Z' }
    setup()

    expect(await screen.findByRole('dialog', { name: 'Session running' })).toBeInTheDocument()
    mocks.active = undefined
  })
})
