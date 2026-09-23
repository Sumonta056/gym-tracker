import type { SyncStatusReport } from '../../lib/db/repository'

export const SYNCED: SyncStatusReport = { status: 'synced', pending: 0 }

export function syncedStatus(): SyncStatusReport {
  return SYNCED
}
