import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  ErrorLogCard,
  errorLogText,
  LOG_CLEAR_FAILED,
  LOG_COPIED,
  LOG_COPY_FAILED,
  LOG_READ_FAILED,
  NO_ERRORS,
} from './ErrorLogCard'

import type { ErrorLogSource } from './ErrorLogCard'
import type * as Report from '../../lib/errors/report'
import type { ErrorRecord } from '../../lib/schema/errorRecord'

vi.mock('../../lib/errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
}))

function record(index: number, overrides: Partial<ErrorRecord> = {}): ErrorRecord {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    at: `2026-10-05T10:00:${String(index).padStart(2, '0')}.000Z`,
    source: 'boundary',
    message: `error ${String(index)}`,
    stack: `Error: error ${String(index)}\n    at render`,
    route: '/log',
    ...overrides,
  }
}

function fakeSource(records: ErrorRecord[] = []) {
  return {
    listErrors: vi.fn<ErrorLogSource['listErrors']>(() => Promise.resolve(records)),
    clearErrors: vi.fn<ErrorLogSource['clearErrors']>(() => Promise.resolve()),
  }
}

describe('errorLogText', () => {
  it('writes the time, the source, the route, the message and the stack of each error', () => {
    expect(errorLogText([record(2), record(1)])).toBe(
      [
        '2026-10-05T10:00:02.000Z boundary /log\nerror 2\nError: error 2\n    at render',
        '2026-10-05T10:00:01.000Z boundary /log\nerror 1\nError: error 1\n    at render',
      ].join('\n\n'),
    )
  })

  it('leaves out a stack that does not exist', () => {
    expect(errorLogText([record(1, { stack: null })])).toBe(
      '2026-10-05T10:00:01.000Z boundary /log\nerror 1',
    )
  })
})

describe('ErrorLogCard', () => {
  it('says there are no errors and disables both buttons on an empty log', async () => {
    render(<ErrorLogCard source={fakeSource()} />)

    expect(await screen.findByText(NO_ERRORS)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy all' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })

  it('lists every error with its message, source and route', async () => {
    render(<ErrorLogCard source={fakeSource([record(2), record(1, { source: 'sync' })])} />)

    const list = await screen.findByRole('list', { name: '2 errors on this device' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('error 2')
    expect(items[1]).toHaveTextContent('sync')
    expect(items[1]).toHaveTextContent('/log')
  })

  it('lets the keyboard reach the list so a long log can scroll', async () => {
    render(<ErrorLogCard source={fakeSource([record(1)])} />)

    expect(await screen.findByRole('list')).toHaveAttribute('tabindex', '0')
  })

  it('copies every error when Copy all is pressed', async () => {
    const records = [record(2), record(1)]
    const copy = vi.fn(() => Promise.resolve())
    render(<ErrorLogCard source={fakeSource(records)} copy={copy} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Copy all' }))

    expect(copy).toHaveBeenCalledWith(errorLogText(records))
    expect(await screen.findByText(LOG_COPIED)).toBeInTheDocument()
  })

  it('says the copy failed when the clipboard refuses', async () => {
    const copy = vi.fn(() => Promise.reject(new Error('denied')))
    render(<ErrorLogCard source={fakeSource([record(1)])} copy={copy} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Copy all' }))

    expect(await screen.findByText(LOG_COPY_FAILED)).toBeInTheDocument()
  })

  it('clears the log when Clear is pressed', async () => {
    const source = fakeSource([record(1)])
    render(<ErrorLogCard source={source} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Clear' }))

    expect(source.clearErrors).toHaveBeenCalledTimes(1)
  })

  it('says the clear failed when the device refuses', async () => {
    const source = fakeSource([record(1)])
    source.clearErrors.mockRejectedValueOnce(new Error('locked'))
    render(<ErrorLogCard source={source} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Clear' }))

    expect(await screen.findByText(LOG_CLEAR_FAILED)).toBeInTheDocument()
  })

  it('says the log could not be read when the read fails', async () => {
    const source = fakeSource()
    source.listErrors.mockRejectedValue(new Error('DatabaseClosedError'))
    render(<ErrorLogCard source={source} />)

    expect(await screen.findByText(LOG_READ_FAILED)).toBeInTheDocument()
  })
})
