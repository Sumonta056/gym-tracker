'use client'

import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { startedText } from '../workout/SessionTimer'

import { HistoryLink } from './HistoryLink'
import {
  dayNumber,
  dayTitle,
  deleteLabel,
  recordsText,
  rowDetail,
  sessionPath,
  volumeDisplay,
  weekday,
} from './historyText'
import { StarIcon, TrashIcon } from './icons'
import { VolumeBar } from './VolumeBar'

import type { HistoryRow } from './useWorkoutHistory'
import type { UnitSystem } from '../../lib/schema/profile'

export type DayCardProps = {
  date: string
  rows: readonly HistoryRow[]
  unit: UnitSystem
  maxKg: number
  today: boolean
  onDelete: (row: HistoryRow) => void
}

function SessionRow({
  row,
  unit,
  maxKg,
  onDelete,
}: {
  row: HistoryRow
  unit: UnitSystem
  maxKg: number
  onDelete: (row: HistoryRow) => void
}) {
  const { session, stats, groups } = row
  const empty = stats.setCount === 0
  const records = stats.newRecords.length

  return (
    <li className="border-border flex items-center pr-1 not-first:border-t">
      <HistoryLink
        href={sessionPath(session.id)}
        className="flex min-h-11 min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-1.5 pl-3.5 text-left focus-visible:-outline-offset-2"
      >
        <span className="sr-only">{`${dayTitle(session.entry_date)} · `}</span>
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <strong className="text-text text-[15px] font-bold whitespace-nowrap">
            {startedText(session.started_at)}
            {empty ? null : (
              <>
                <span className="text-muted font-semibold"> · </span>
                {volumeDisplay(stats.volumeKg, unit)}
              </>
            )}
          </strong>
          {records > 0 ? (
            <span className="text-accent inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap">
              <StarIcon className="size-3" />
              {recordsText(records)}
            </span>
          ) : null}
        </span>
        {empty ? null : (
          <VolumeBar className="mt-1 mb-0.5" volumeKg={stats.volumeKg} maxKg={maxKg} />
        )}
        <span className="text-muted text-[13px] break-words">{rowDetail(stats, groups)}</span>
      </HistoryLink>
      <button
        type="button"
        aria-label={deleteLabel(session)}
        onClick={() => {
          onDelete(row)
        }}
        className="text-dim hover:text-danger hover:bg-danger/10 inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] focus-visible:-outline-offset-2"
      >
        <TrashIcon className="size-[17px]" />
      </button>
    </li>
  )
}

export function DayCard({ date, rows, unit, maxKg, today, onDelete }: DayCardProps) {
  return (
    <div
      data-testid="day-card"
      className="bg-surface border-border rounded-card flex overflow-hidden border"
    >
      <div
        aria-hidden="true"
        data-today={today ? 'true' : undefined}
        className={cn(
          'flex w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 py-2.5',
          today ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text',
        )}
      >
        <span className="text-[22px] leading-none font-extrabold tracking-[-0.5px]">
          {dayNumber(date)}
        </span>
        <MicroLabel tone={today ? 'inherit' : 'muted'}>{weekday(date)}</MicroLabel>
      </div>
      <ul className="min-w-0 flex-1">
        {rows.map((row) => (
          <SessionRow
            key={row.session.id}
            row={row}
            unit={unit}
            maxKg={maxKg}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  )
}
