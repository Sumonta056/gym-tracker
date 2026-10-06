import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppGuards } from './AppGuards'

const mocks = vi.hoisted(() => ({ state: 'current' }))

vi.mock('../../lib/db/repository', () => ({
  getVersionState: () => mocks.state,
  subscribeVersionState: () => () => undefined,
}))

function chunkRejection(): Event {
  return Object.assign(new Event('unhandledrejection'), {
    reason: Object.assign(new Error('Loading chunk 812 failed.'), { name: 'ChunkLoadError' }),
  })
}

beforeEach(() => {
  mocks.state = 'current'
  window.sessionStorage.clear()
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
})
