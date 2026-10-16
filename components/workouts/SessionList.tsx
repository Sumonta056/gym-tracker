'use client'

import { useId } from 'react'

import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'

import { HistoryLink } from './HistoryLink'
import { rowLine, rowTitle, sessionPath } from './historyText'

import type { HistoryList } from './useWorkoutHistory'

export const EMPTY_HISTORY = 'No finished session yet. Start one above.'

export type SessionListProps = { list: HistoryList; note: string | null; onMore: () => void }

export function SessionList({ list, note, onMore }: SessionListProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="mt-8 flex flex-col gap-3">
      <MicroLabel as="p" id={headingId}>
        History
      </MicroLabel>
      {note === null ? null : (
        <p role="status" className="text-text text-sm">
          {note}
        </p>
      )}
      {list.rows.length === 0 ? (
        <p className="text-muted text-sm">{EMPTY_HISTORY}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.rows.map(({ session, stats }) => (
            <li key={session.id} className="flex">
              <HistoryLink
                href={sessionPath(session.id)}
                className="bg-surface border-border rounded-card flex min-h-11 w-full flex-col gap-1 border p-4 text-left"
              >
                <strong className="text-text text-[15px] font-bold">{rowTitle(session)}</strong>
                <span className="text-muted text-sm">{rowLine(stats, list.unit)}</span>
              </HistoryLink>
            </li>
          ))}
        </ul>
      )}
      {list.hasMore ? (
        <SecondaryButton className="max-w-sm self-start" onClick={onMore}>
          Show more
        </SecondaryButton>
      ) : null}
    </section>
  )
}
