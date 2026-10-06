import { afterEach, describe, expect, it, vi } from 'vitest'

import { currentRoute, describeError, errorText, reportError, UNKNOWN_ERROR } from './report'

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
  it('writes the source, the route and the message to the console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    reportError(new Error('boom'), { route: '/log', source: 'boundary' })

    expect(spy).toHaveBeenCalledWith('[boundary] /log boom', expect.any(String))
  })
})
