import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CHUNK_RELOAD_KEY,
  installChunkReload,
  isChunkLoadError,
  reloadOnce,
  sessionStore,
} from './chunk'

import type { ReloadStorage } from './chunk'

function memoryStorage(): ReloadStorage {
  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

function chunkError(): Error {
  return Object.assign(new Error('Loading chunk 812 failed.'), { name: 'ChunkLoadError' })
}

function rejection(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection'), { reason })
}

function errorEvent(error: unknown): Event {
  return Object.assign(new Event('error'), { error })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isChunkLoadError', () => {
  it('knows a ChunkLoadError by its name', () => {
    expect(isChunkLoadError(chunkError())).toBe(true)
  })

  it('knows a failed dynamic import by its message', () => {
    expect(
      isChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: /_next/static/chunks/a.js'),
      ),
    ).toBe(true)
  })

  it('knows the Safari wording of a failed module script', () => {
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('ignores any other error', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false)
  })

  it('ignores a value that is not an Error', () => {
    expect(isChunkLoadError('Loading chunk 812 failed.')).toBe(false)
  })
})

describe('reloadOnce', () => {
  it('reloads the first time and writes the flag', () => {
    const storage = memoryStorage()
    const reload = vi.fn()

    expect(reloadOnce(storage, reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(storage.getItem(CHUNK_RELOAD_KEY)).not.toBeNull()
  })

  it('does not reload a second time in the same session', () => {
    const storage = memoryStorage()
    const reload = vi.fn()

    reloadOnce(storage, reload)
    expect(reloadOnce(storage, reload)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload with no session storage', () => {
    const reload = vi.fn()

    expect(reloadOnce(null, reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload when the session storage throws', () => {
    const reload = vi.fn()
    const broken: ReloadStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => undefined,
    }

    expect(reloadOnce(broken, reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('sessionStore', () => {
  it('is null outside a browser', () => {
    expect(sessionStore()).toBeNull()
  })

  it('returns the session storage of the window', () => {
    const storage = memoryStorage()
    vi.stubGlobal('window', { sessionStorage: storage })

    expect(sessionStore()).toBe(storage)
  })
})

describe('installChunkReload', () => {
  it('reloads once on an unhandled chunk rejection', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = memoryStorage()
    installChunkReload(target, () => storage, reload)

    target.dispatchEvent(rejection(chunkError()))
    target.dispatchEvent(rejection(chunkError()))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads once on a chunk error event', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = memoryStorage()
    installChunkReload(target, () => storage, reload)

    target.dispatchEvent(errorEvent(chunkError()))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ignores any other error', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = memoryStorage()
    installChunkReload(target, () => storage, reload)

    target.dispatchEvent(rejection(new Error('boom')))
    target.dispatchEvent(errorEvent(new Error('boom')))

    expect(reload).not.toHaveBeenCalled()
  })

  it('stops listening after the teardown', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = memoryStorage()
    const stop = installChunkReload(target, () => storage, reload)

    stop()
    target.dispatchEvent(rejection(chunkError()))

    expect(reload).not.toHaveBeenCalled()
  })
})
