'use client'

import { useSyncExternalStore } from 'react'

export const KEYBOARD_GAP_PX = 150

function visualViewport(): VisualViewport | null {
  if (typeof window === 'undefined' || !('visualViewport' in window)) {
    return null
  }

  return window.visualViewport
}

function subscribe(onChange: () => void): () => void {
  const viewport = visualViewport()

  if (viewport === null) {
    return () => undefined
  }

  viewport.addEventListener('resize', onChange)

  return () => {
    viewport.removeEventListener('resize', onChange)
  }
}

export function isKeyboardOpen(): boolean {
  const viewport = visualViewport()

  if (viewport === null) {
    return false
  }

  return window.innerHeight - viewport.height * viewport.scale > KEYBOARD_GAP_PX
}

function serverSnapshot(): boolean {
  return false
}

export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, isKeyboardOpen, serverSnapshot)
}
