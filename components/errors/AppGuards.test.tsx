import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '../../lib/errors/report'

import { AppGuards } from './AppGuards'

import type * as Report from '../../lib/errors/report'

const mocks = vi.hoisted(() => ({ state: 'current' }))

vi.mock('../../lib/db/repository', () => ({
  getVersionState: () => mocks.state,
  subscribeVersionState: () => () => undefined,
}))

vi.mock('../../lib/errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
}))

function chunkRejection(): Event {
  return Object.assign(new Event('unhandledrejection'), {
    reason: Object.assign(new Error('Loading chunk 812 failed.'), { name: 'ChunkLoadError' }),
  })
}

beforeEach(() => {
  mocks.state = 'current'
  window.sessionStorage.clear()
  vi.mocked(reportError).mockClear()
})

describe('AppGuards', () => {
  it('reloads once when a chunk fails to load', () => {
    const reload = vi.fn()
    render(<AppGuards reload={reload} />)

    window.dispatchEvent(chunkRejection())
    window.dispatchEvent(chunkRejection())

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('stops listening after it unmounts', () => {
    const reload = vi.fn()
    const { unmount } = render(<AppGuards reload={reload} />)

    unmount()
    window.dispatchEvent(chunkRejection())

    expect(reload).not.toHaveBeenCalled()
  })

  it('shows the version banner when the database turned stale', () => {
    mocks.state = 'stale'
    render(<AppGuards reload={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('A new version is ready.')
  })

  it('reports an unhandled rejection to the error log', () => {
    const reason = new Error('lost')
    render(<AppGuards reload={vi.fn()} />)

    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }))

    expect(reportError).toHaveBeenCalledWith(reason, { route: '/', source: 'rejection' })
  })

  it('stops reporting after it unmounts', () => {
    const { unmount } = render(<AppGuards reload={vi.fn()} />)

    unmount()
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'lost' }))

    expect(reportError).not.toHaveBeenCalled()
  })
})
