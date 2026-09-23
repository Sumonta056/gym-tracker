'use client'

import { useSyncStatus } from '../../lib/db/repository'
import { StatusChip } from '../ui/StatusChip'

import type { SyncStatusReport } from '../../lib/db/repository'
import type { SyncStatus as ChipStatus } from '../ui/StatusChip'

export function chipStatus({ status, pending }: SyncStatusReport): ChipStatus {
  if (status === 'offline' || status === 'syncing') {
    return status
  }

  return status === 'error' || pending > 0 ? 'pending' : 'synced'
}

export function SyncChipView({
  report,
  announce = true,
  className,
}: {
  report: SyncStatusReport
  announce?: boolean
  className?: string
}) {
  return <StatusChip status={chipStatus(report)} announce={announce} className={className} />
}

export function SyncChip({ className }: { className?: string }) {
  return <SyncChipView report={useSyncStatus()} className={className} />
}
