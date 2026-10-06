export const CHUNK_RELOAD_KEY = 'gym-tracker:chunk-reload'

const CHUNK_MESSAGES = [
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
]

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.name === 'ChunkLoadError' || CHUNK_MESSAGES.some((pattern) => pattern.test(error.message))
  )
}

export type ReloadStorage = Pick<Storage, 'getItem' | 'setItem'>

export function reloadOnce(storage: ReloadStorage | null, reload: () => void): boolean {
  if (storage === null) {
    return false
  }

  try {
    if (storage.getItem(CHUNK_RELOAD_KEY) !== null) {
      return false
    }

    storage.setItem(CHUNK_RELOAD_KEY, new Date().toISOString())
  } catch {
    return false
  }

  reload()

  return true
}

export function sessionStore(): ReloadStorage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

type ListenTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export function installChunkReload(
  target: ListenTarget,
  storage: () => ReloadStorage | null,
  reload: () => void,
): () => void {
  const handle = (error: unknown): void => {
    if (isChunkLoadError(error)) {
      reloadOnce(storage(), reload)
    }
  }
  const onError = (event: Event): void => {
    handle((event as ErrorEvent).error)
  }
  const onRejection = (event: Event): void => {
    handle((event as PromiseRejectionEvent).reason)
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)

  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
