import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { startSync } from '../../lib/db/repository'

import { SyncRunner } from './SyncRunner'

const mocks = vi.hoisted(() => ({ stop: vi.fn() }))

vi.mock('../../lib/db/repository', () => ({
  startSync: vi.fn(() => mocks.stop),
}))

function running(): number {
  return vi.mocked(startSync).mock.calls.length - mocks.stop.mock.calls.length
}

beforeEach(() => {
  vi.mocked(startSync).mockClear()
  mocks.stop.mockClear()
})

describe('SyncRunner', () => {
  it('starts the sync worker once on mount', () => {
    render(<SyncRunner />)
    expect(startSync).toHaveBeenCalledTimes(1)
    expect(mocks.stop).not.toHaveBeenCalled()
  })

  it('renders nothing', () => {
    const { container } = render(<SyncRunner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stops the worker on unmount', () => {
    const { unmount } = render(<SyncRunner />)
    unmount()
    expect(mocks.stop).toHaveBeenCalledTimes(1)
    expect(running()).toBe(0)
  })

  it('never starts again on a re-render', () => {
    const { rerender } = render(<SyncRunner />)
    rerender(<SyncRunner />)
    rerender(<SyncRunner />)
    expect(startSync).toHaveBeenCalledTimes(1)
  })

  it('leaves exactly one worker running under strict mode', () => {
    const { unmount } = render(
      <StrictMode>
        <SyncRunner />
      </StrictMode>,
    )
    expect(running()).toBe(1)
    unmount()
    expect(running()).toBe(0)
  })
})
