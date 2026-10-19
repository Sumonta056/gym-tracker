'use client'

import { useId, useState } from 'react'

import { localDate } from '../../lib/schema/dailyEntry'
import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'

import { DayCard } from './DayCard'
import { DeleteSessionSheet } from './DeleteSessionSheet'
import { byMonthAndDay, sessionsText } from './historyText'

import type { DeleteTarget, Discard } from './DeleteSessionSheet'
import type { HistoryList } from './useWorkoutHistory'

export const EMPTY_HISTORY = 'No finished session yet. Start one above.'

export type SessionListProps = {
  list: HistoryList
  note: string | null
  onMore: () => void
  today?: string
  discard?: Discard
}

export function SessionList({ list, note, onMore, today, discard }: SessionListProps) {
  const headingId = useId()
  const [target, setTarget] = useState<DeleteTarget | null>(null)
  const currentDay = today ?? localDate()
  const maxKg = Math.max(0, ...list.rows.map((row) => row.stats.volumeKg))

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
        byMonthAndDay(list.rows).map((month) => (
          <div key={month.label} className="flex flex-col gap-2 not-first-of-type:mt-3">
            <h2 className="flex items-baseline justify-between gap-3 px-0.5">
              <MicroLabel>{month.label}</MicroLabel>
              <span className="text-muted text-xs font-normal">{sessionsText(month.count)}</span>
            </h2>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {month.days.map((day) => (
                <li key={day.date} className="min-w-0">
                  <DayCard
                    date={day.date}
                    rows={day.rows}
                    unit={list.unit}
                    maxKg={maxKg}
                    today={currentDay}
                    onDelete={(row) => {
                      setTarget({ session: row.session, stats: row.stats })
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      {list.hasMore ? (
        <SecondaryButton className="max-w-sm self-start" onClick={onMore}>
          Show more
        </SecondaryButton>
      ) : null}
      <DeleteSessionSheet
        target={target}
        unit={list.unit}
        discard={discard}
        onClose={() => {
          setTarget(null)
        }}
      />
    </section>
  )
}
