import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installErrorListeners } from './listeners'
import { reportError } from './report'

import type * as Report from './report'

vi.mock('./report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
  currentRoute: () => '/log',
}))

function errorEvent(fields: { error?: unknown; message?: string }): Event {
  return Object.assign(new Event('error'), { error: null, message: '', ...fields })
}

function rejection(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection'), { reason })
}

beforeEach(() => {
  vi.mocked(reportError).mockClear()
})

describe('installErrorListeners', () => {
  it('reports a window error with the window source', () => {
    const target = new EventTarget()
    const error = new Error('boom')
    installErrorListeners(target)

    target.dispatchEvent(errorEvent({ error }))

    expect(reportError).toHaveBeenCalledWith(error, { route: '/log', source: 'window' })
  })

  it('reports the message when the error event carries no error', () => {
    const target = new EventTarget()
    installErrorListeners(target)

    target.dispatchEvent(errorEvent({ message: 'Script error.' }))

    expect(reportError).toHaveBeenCalledWith('Script error.', { route: '/log', source: 'window' })
  })

  it('reports an unhandled rejection with the rejection source', () => {
    const target = new EventTarget()
    const reason = new Error('lost')
    installErrorListeners(target)

    target.dispatchEvent(rejection(reason))

    expect(reportError).toHaveBeenCalledWith(reason, { route: '/log', source: 'rejection' })
  })

  it('stops listening after the teardown', () => {
    const target = new EventTarget()
    const stop = installErrorListeners(target)

    stop()
    target.dispatchEvent(rejection(new Error('lost')))

    expect(reportError).not.toHaveBeenCalled()
  })
})
