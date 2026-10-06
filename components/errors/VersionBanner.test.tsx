import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VERSION_BLOCKED, VERSION_READY, VersionBanner, VersionBannerView } from './VersionBanner'

const mocks = vi.hoisted(() => ({
  state: 'current',
  listeners: new Set<() => void>(),
}))

vi.mock('../../lib/db/repository', () => ({
  getVersionState: () => mocks.state,
  subscribeVersionState: (listener: () => void) => {
    mocks.listeners.add(listener)

    return () => {
      mocks.listeners.delete(listener)
    }
  },
}))

beforeEach(() => {
  mocks.state = 'current'
  mocks.listeners.clear()
})

describe('VersionBannerView', () => {
  it('asks to close the other tabs while the upgrade is blocked, with no Reload button', () => {
    render(<VersionBannerView state="blocked" onReload={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent(VERSION_BLOCKED)
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
  })
})

describe('VersionBanner', () => {
  it('shows nothing while the version is current', () => {
    render(<VersionBanner reload={vi.fn()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says a new version is ready when the database turned stale', () => {
    mocks.state = 'stale'
    render(<VersionBanner reload={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent(VERSION_READY)
  })

  it('reloads the page when Reload is pressed', async () => {
    mocks.state = 'stale'
    const reload = vi.fn()
    render(<VersionBanner reload={reload} />)

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('appears when the state changes after the first render', () => {
    render(<VersionBanner reload={vi.fn()} />)

    mocks.state = 'stale'
    act(() => {
      for (const listener of mocks.listeners) listener()
    })

    expect(screen.getByRole('alert')).toHaveTextContent(VERSION_READY)
  })

  it('renders nothing on the server, where the version is always current', () => {
    mocks.state = 'stale'

    expect(renderToString(<VersionBanner reload={vi.fn()} />)).toBe('')
  })
})
