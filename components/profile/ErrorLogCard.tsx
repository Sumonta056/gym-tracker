'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'

import { clearErrors, listErrors } from '../../lib/db/repository'
import { safeQuery } from '../../lib/db/safeQuery'
import { copyText } from '../../lib/errors/browser'
import { ERROR_LOG_QUERY } from '../../lib/errors/report'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'

import type { ErrorRecord } from '../../lib/schema/errorRecord'

export type ErrorLogSource = {
  listErrors: () => Promise<ErrorRecord[]>
  clearErrors: () => Promise<void>
}

export const REPOSITORY_ERROR_LOG_SOURCE: ErrorLogSource = { listErrors, clearErrors }

export const NO_ERRORS = 'No errors on this device.'

export const LOG_READ_FAILED = 'The error list on this device could not be read.'

export const LOG_COPIED = 'The errors are copied.'

export const LOG_COPY_FAILED = 'The errors could not be copied.'

export const LOG_CLEAR_FAILED = 'The errors could not be cleared.'

const TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function errorLogText(records: ErrorRecord[]): string {
  return records
    .map((record) =>
      [`${record.at} ${record.source} ${record.route}`, record.message, record.stack]
        .filter((line): line is string => line !== null)
        .join('\n'),
    )
    .join('\n\n')
}

type Notice = { text: string; failed: boolean }

export type ErrorLogCardProps = {
  source?: ErrorLogSource
  copy?: (text: string) => Promise<void>
  className?: string
}

export function ErrorLogCard({
  source = REPOSITORY_ERROR_LOG_SOURCE,
  copy = copyText,
  className,
}: ErrorLogCardProps) {
  const records = useLiveQuery(
    safeQuery(() => source.listErrors(), ERROR_LOG_QUERY),
    [source],
  )
  const [notice, setNotice] = useState<Notice | null>(null)
  const shown = records ?? []

  function copyAll(): void {
    void copy(errorLogText(shown)).then(
      () => {
        setNotice({ text: LOG_COPIED, failed: false })
      },
      () => {
        setNotice({ text: LOG_COPY_FAILED, failed: true })
      },
    )
  }

  function clearLog(): void {
    void source.clearErrors().then(
      () => {
        setNotice(null)
      },
      () => {
        setNotice({ text: LOG_CLEAR_FAILED, failed: true })
      },
    )
  }

  return (
    <Card data-testid="error-log-card" className={className}>
      <MicroLabel as="p">Errors</MicroLabel>
      {records === undefined ? (
        <p className="text-muted mt-2 text-sm">Reading the error list…</p>
      ) : null}
      {records === null ? <p className="text-danger mt-2 text-sm">{LOG_READ_FAILED}</p> : null}
      {records?.length === 0 ? <p className="text-muted mt-2 text-sm">{NO_ERRORS}</p> : null}
      {shown.length > 0 ? (
        <ol
          tabIndex={0}
          aria-label={`${String(shown.length)} errors on this device`}
          className="border-border divide-border rounded-input mt-2 max-h-72 divide-y overflow-y-auto border"
        >
          {shown.map((record) => (
            <li key={record.id} className="px-3 py-2">
              <p className="text-text text-[13px] font-bold break-words">{record.message}</p>
              <p className="text-muted text-xs">
                {TIME.format(new Date(record.at))} · {record.source} · {record.route}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SecondaryButton disabled={shown.length === 0} onClick={copyAll}>
          Copy all
        </SecondaryButton>
        <SecondaryButton tone="danger" disabled={shown.length === 0} onClick={clearLog}>
          Clear
        </SecondaryButton>
      </div>
      <p
        role="status"
        className={notice?.failed === true ? 'text-danger mt-2 text-xs' : 'text-muted mt-2 text-xs'}
      >
        {notice?.text ?? ''}
      </p>
    </Card>
  )
}
