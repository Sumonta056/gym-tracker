'use client'

import { useId } from 'react'

import { SyncChipView } from '../sync/SyncChip'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'

import type { SyncStatusReport } from '../../lib/db/repository'

export type SyncCardProps = {
  report: SyncStatusReport
  busy: boolean
  onSyncNow: () => void
  className?: string
}

export function SyncCard({ report, busy, onSyncNow, className }: SyncCardProps) {
  const hintId = useId()
  const offline = report.status === 'offline'
  const running = busy || report.status === 'syncing'

  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-3">
        <MicroLabel as="p">Sync</MicroLabel>
        <SyncChipView report={report} announce={false} />
      </div>
      <dl className="mt-2.5">
        <div className="flex min-h-11 items-center justify-between">
          <dt className="text-muted text-[13px]">Pending writes</dt>
          <dd className="text-text text-[13px] font-bold">{report.pending}</dd>
        </div>
      </dl>
      <SecondaryButton
        className="mt-3"
        disabled={running || offline}
        aria-describedby={offline ? hintId : undefined}
        onClick={onSyncNow}
      >
        {running ? 'Syncing…' : 'Sync now'}
      </SecondaryButton>
      {offline ? (
        <p id={hintId} className="text-muted mt-2 text-xs">
          Offline. The writes wait on this device until the network is back.
        </p>
      ) : null}
    </Card>
  )
}
