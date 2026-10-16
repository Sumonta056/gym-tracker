'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'

import { safeQuery } from '../db/safeQuery'

import { deadLetterCount, listDeadLetters } from './deadLetters'
import { pendingCount } from './outbox'
import { getSyncState, subscribeSyncState } from './worker'

import type { SyncState } from './worker'
import type { DeadLetter } from '../db/dexie'

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error' | 'unknown'

export interface SyncStatusReport {
  status: SyncStatus
  pending: number
  failed: number
}

export function toStatus(online: boolean, state: SyncState): SyncStatus {
  if (!online || state === 'offline') {
    return 'offline'
  }

  if (state === 'syncing' || state === 'error') {
    return state
  }

  return 'synced'
}

export function useSyncStatus(): SyncStatusReport {
  const [online, setOnline] = useState(true)
  const [state, setState] = useState<SyncState>('idle')

  useEffect(() => {
    const read = (): void => {
      setOnline(globalThis.navigator.onLine)
    }

    read()
    window.addEventListener('online', read)
    window.addEventListener('offline', read)

    return () => {
      window.removeEventListener('online', read)
      window.removeEventListener('offline', read)
    }
  }, [])

  useEffect(() => {
    const read = (): void => {
      setState(getSyncState())
    }

    read()

    return subscribeSyncState(read)
  }, [])

  const pending = useLiveQuery(
    safeQuery(() => pendingCount(), 'sync pending count'),
    [],
  )
  const failed = useLiveQuery(
    safeQuery(() => deadLetterCount(), 'sync failed count'),
    [],
  )

  if (pending === null || failed === null) {
    return { status: 'unknown', pending: 0, failed: 0 }
  }

  return { status: toStatus(online, state), pending: pending ?? 0, failed: failed ?? 0 }
}

export function useDeadLetters(): DeadLetter[] {
  return (
    useLiveQuery(
      safeQuery(() => listDeadLetters(), 'sync failed writes'),
      [],
    ) ?? []
  )
}
