import { currentRoute, reportError } from './report'

type ListenTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export function installErrorListeners(target: ListenTarget): () => void {
  const onError = (event: Event): void => {
    const failure: unknown = (event as ErrorEvent).error

    reportError(failure ?? (event as ErrorEvent).message, {
      route: currentRoute(),
      source: 'window',
    })
  }
  const onRejection = (event: Event): void => {
    reportError((event as PromiseRejectionEvent).reason, {
      route: currentRoute(),
      source: 'rejection',
    })
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)

  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
