import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { recordError } from '../db/repository'

import {
  currentRoute,
  describeError,
  ERROR_LOG_QUERY,
  errorText,
  reportError,
  UNKNOWN_ERROR,
} from './report'

vi.mock('../db/repository', () => ({
  recordError: vi.fn(() => Promise.resolve()),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('describeError', () => {
  it('keeps the message and the stack of an Error', () => {
    const error = new Error('boom')

    expect(describeError(error)).toEqual({ message: 'boom', stack: error.stack ?? null })
  })

  it('names an Error with an empty message by its name', () => {
    expect(describeError(new TypeError('')).message).toBe('TypeError')
  })

  it('keeps a thrown string as the message', () => {
    expect(describeError('boom')).toEqual({ message: 'boom', stack: null })
  })

  it('writes a thrown object as JSON', () => {
    expect(describeError({ code: 7 }).message).toBe('{"code":7}')
  })

  it('writes undefined as the word undefined', () => {
    expect(describeError(undefined).message).toBe('undefined')
  })

  it('names a value that JSON cannot write', () => {
    const loop: Record<string, unknown> = {}
    loop.self = loop

    expect(describeError(loop).message).toBe(UNKNOWN_ERROR)
  })
})

describe('errorText', () => {
  it('joins the message, the digest and the stack for the clipboard', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' })
    error.stack = 'Error: boom\n    at render'

    expect(errorText(error)).toBe('boom\nDigest: abc123\nError: boom\n    at render')
  })

  it('leaves out a digest and a stack that do not exist', () => {
    expect(errorText('boom')).toBe('boom')
  })
})

describe('currentRoute', () => {
  it('is empty outside a browser', () => {
    expect(currentRoute()).toBe('')
  })

  it('reads the path of the open page', () => {
    vi.stubGlobal('window', { location: { pathname: '/log' } })

    expect(currentRoute()).toBe('/log')
  })
})

describe('reportError', () => {
  beforeEach(() => {
    vi.mocked(recordError).mockClear()
  })

  it('writes the source, the route and the message to the console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    reportError(new Error('boom'), { route: '/log', source: 'boundary' })

    expect(spy).toHaveBeenCalledWith('[boundary] /log boom', expect.any(String))
  })

  it('records the error in the local log', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const error = new Error('boom')

    reportError(error, { route: '/log', source: 'boundary' })

    await vi.waitFor(() => {
      expect(recordError).toHaveBeenCalledWith({
        source: 'boundary',
        message: 'boom',
        stack: error.stack ?? null,
        route: '/log',
      })
    })
  })

  it('records the error only after the current task ends', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    reportError(new Error('later'), { route: '/', source: 'live-query' })

    expect(recordError).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'later' }))
    await vi.waitFor(() => {
      expect(recordError).toHaveBeenCalledWith(expect.objectContaining({ message: 'later' }))
    })
  })

  it('never records a failed read of the error log itself', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    reportError(new Error(`${ERROR_LOG_QUERY}: closed`), { route: '/', source: 'live-query' })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(spy).toHaveBeenCalled()
    expect(recordError).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: `${ERROR_LOG_QUERY}: closed` }),
    )
  })

  it('never throws when the log cannot be written', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(recordError).mockRejectedValueOnce(new Error('DatabaseClosedError'))

    expect(() => {
      reportError(new Error('boom'), { route: '/', source: 'window' })
    }).not.toThrow()
    await vi.waitFor(() => {
      expect(recordError).toHaveBeenCalled()
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('never throws when the repository cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.resetModules()
    vi.doMock('../db/repository', () => {
      throw new Error('ChunkLoadError')
    })
    const fresh = await import('./report')

    try {
      expect(() => {
        fresh.reportError(new Error('boom'), { route: '/', source: 'window' })
      }).not.toThrow()
      await new Promise((resolve) => setTimeout(resolve, 20))
    } finally {
      vi.doUnmock('../db/repository')
      vi.resetModules()
    }
  })

  it('never throws when the console throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console gone')
    })

    expect(() => {
      reportError(new Error('boom'), { route: '/', source: 'window' })
    }).not.toThrow()
  })
})
