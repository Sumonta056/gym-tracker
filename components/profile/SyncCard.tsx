'use client'

import { useId } from 'react'

import { headerDate } from '../dashboard/summary'
import { SyncChipView } from '../sync/SyncChip'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'

import type { DailyEntry, DeadLetter } from '../../lib/db/dexie'
import type { SyncStatusReport } from '../../lib/db/repository'

export type SyncCardProps = {
  report: SyncStatusReport
  busy: boolean
  onSyncNow: () => void
  deadLetters?: DeadLetter[]
  onRetry?: (id: string) => void
  onDiscard?: (id: string) => void
  deadLetterError?: string | null
  className?: string
}

function ignore(): void {
  return undefined
}

export function failedHint(count: number): string {
  const writes = count === 1 ? '1 write' : `${String(count)} writes`

  return `${writes} could not reach the server. Retry sends ${count === 1 ? 'it' : 'them'} again. Discard keeps the data on this device only.`
}

export function deadLetterName(letter: DeadLetter): string {
  if (letter.table_name === 'profiles') {
    return 'Profile settings'
  }

  const { weekday, dayMonth } = headerDate((letter.payload as DailyEntry).entry_date)

  return `${weekday} ${dayMonth}`
}

export function SyncCard({
  report,
  busy,
  onSyncNow,
  deadLetters = [],
  onRetry = ignore,
  onDiscard = ignore,
  deadLetterError = null,
  className,
}: SyncCardProps) {
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
        <div className="flex min-h-11 items-center justify-between">
          <dt className="text-muted text-[13px]">Failed writes</dt>
          <dd
            className={
              report.failed > 0
                ? 'text-danger text-[13px] font-bold'
                : 'text-text text-[13px] font-bold'
            }
          >
            {report.failed}
          </dd>
        </div>
      </dl>
      {report.failed > 0 ? (
        <p className="text-danger mt-2 text-xs">{failedHint(report.failed)}</p>
      ) : null}
      {deadLetters.length === 0 ? null : (
        <ul aria-label="Failed writes" className="mt-3 grid gap-3">
          {deadLetters.map((letter) => {
            const name = deadLetterName(letter)

            return (
              <li key={letter.id} className="border-border border-t pt-3">
                <p className="text-text text-sm font-bold">{name}</p>
                <p className="text-muted mt-0.5 text-xs break-words">{letter.last_error}</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <SecondaryButton
                    aria-label={`Retry ${name}`}
                    onClick={() => {
                      onRetry(letter.id)
                    }}
                  >
                    Retry
                  </SecondaryButton>
                  <SecondaryButton
                    tone="danger"
                    aria-label={`Discard ${name}`}
                    onClick={() => {
                      onDiscard(letter.id)
                    }}
                  >
                    Discard
                  </SecondaryButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {deadLetterError === null ? null : (
        <p role="alert" className="text-danger mt-2 text-xs">
          {deadLetterError}
        </p>
      )}
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
