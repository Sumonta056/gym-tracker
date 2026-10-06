import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '../errors/report'

import { safeQuery } from './safeQuery'

import type * as Report from '../errors/report'

vi.mock('../errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
  currentRoute: () => '/log',
}))

beforeEach(() => {
  vi.mocked(reportError).mockClear()
})

describe('safeQuery', () => {
  it('returns the value of a query that succeeds', async () => {
    await expect(safeQuery(() => Promise.resolve(3), 'count')()).resolves.toBe(3)
  })

  it('reports nothing when the query succeeds', async () => {
    await safeQuery(() => Promise.resolve(3), 'count')()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('returns null when the query rejects', async () => {
    await expect(
      safeQuery(() => Promise.reject(new Error('closed')), 'count')(),
    ).resolves.toBeNull()
  })

  it('returns null when the query throws before it returns a promise', async () => {
    await expect(
      safeQuery(() => {
        throw new Error('closed')
      }, 'count')(),
    ).resolves.toBeNull()
  })

  it('reports the failure as a live-query error with the query name in the message', async () => {
    await safeQuery(() => Promise.reject(new Error('closed')), 'sync pending count')()

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'sync pending count: closed' }),
      { route: '/log', source: 'live-query' },
    )
  })

  it('keeps a stack on the reported error when the failure has none', async () => {
    await safeQuery(
      () => Promise.reject(Object.assign(new Error('closed'), { stack: undefined })),
      'count',
    )()

    const [reported] = vi.mocked(reportError).mock.calls[0] ?? []

    expect(reported).toBeInstanceOf(Error)
    expect((reported as Error).stack).toContain('count: closed')
  })
})
