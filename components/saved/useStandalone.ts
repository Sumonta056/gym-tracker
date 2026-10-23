'use client'

import { useSyncExternalStore } from 'react'

export const STANDALONE_QUERY = '(display-mode: standalone)'

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

function standaloneMedia(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(STANDALONE_QUERY) : null
}

export function readStandalone(): boolean {
  const byMedia = standaloneMedia()?.matches === true
  const byNavigator = (window.navigator as NavigatorWithStandalone).standalone === true

  return byMedia || byNavigator
}

function subscribe(onChange: () => void): () => void {
  const media = standaloneMedia()

  if (media === null) {
    return () => undefined
  }

  media.addEventListener('change', onChange)

  return () => {
    media.removeEventListener('change', onChange)
  }
}

function onServer(): boolean {
  return false
}

export function useStandalone(): boolean {
  return useSyncExternalStore(subscribe, readStandalone, onServer)
}
