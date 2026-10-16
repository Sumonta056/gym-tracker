import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CHUNK_RELOAD_KEY } from '../../lib/errors/chunk'
import { reportError } from '../../lib/errors/report'

import {
  COPIED,
  COPY_FAILED,
  ERROR_BODY,
  ERROR_TITLE,
  ErrorScreen,
  ErrorScreenView,
} from './ErrorScreen'

import type * as Report from '../../lib/errors/report'

vi.mock('../../lib/errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
}))

function boom(): Error {
  const error = new Error('boom')
  error.stack = 'Error: boom\n    at render'
  return error
}

beforeEach(() => {
  vi.mocked(reportError).mockClear()
})

describe('ErrorScreenView', () => {
  it('shows the title and says the data is safe', () => {
    render(<ErrorScreenView error={boom()} />)

    expect(screen.getByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument()
    expect(screen.getByText(ERROR_BODY)).toBeInTheDocument()
  })

  it('reloads the page when Reload is pressed', async () => {
    const reload = vi.fn()
    render(<ErrorScreenView error={boom()} reload={reload} />)

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('copies the message and the stack when Copy error is pressed', async () => {
    const copy = vi.fn(() => Promise.resolve())
    render(<ErrorScreenView error={boom()} copy={copy} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy error' }))

    expect(copy).toHaveBeenCalledWith('boom\nError: boom\n    at render')
  })

  it('says the error is copied', async () => {
    render(<ErrorScreenView error={boom()} copy={() => Promise.resolve()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy error' }))

    expect(await screen.findByText(COPIED)).toBeInTheDocument()
  })

  it('says the copy failed when the clipboard refuses', async () => {
    render(<ErrorScreenView error={boom()} copy={() => Promise.reject(new Error('denied'))} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy error' }))

    expect(await screen.findByText(COPY_FAILED)).toBeInTheDocument()
  })

  it('reports nothing by itself', () => {
    render(<ErrorScreenView error={boom()} />)

    expect(reportError).not.toHaveBeenCalled()
  })
})

describe('ErrorScreen', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('reports the error once with the boundary source', () => {
    const error = boom()
    render(<ErrorScreen error={error} />)

    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(error, { route: '/', source: 'boundary' })
  })

  it('reloads once for a stale chunk', () => {
    const reload = vi.fn()
    const error = Object.assign(new Error('Loading chunk 812 failed.'), { name: 'ChunkLoadError' })

    render(<ErrorScreen error={error} reload={reload} />)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload a stale chunk a second time in the same session', () => {
    const reload = vi.fn()
    const error = Object.assign(new Error('Loading chunk 812 failed.'), { name: 'ChunkLoadError' })
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '2026-10-05T10:00:00.000Z')

    render(<ErrorScreen error={error} reload={reload} />)

    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload by itself for an ordinary error', () => {
    const reload = vi.fn()

    render(<ErrorScreen error={new Error('boom')} reload={reload} />)

    expect(reload).not.toHaveBeenCalled()
  })
})
