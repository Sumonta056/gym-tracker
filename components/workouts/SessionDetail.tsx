'use client'

import { useState } from 'react'

import { formatDuration } from '../../lib/duration'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { recordText, summaryCells } from '../workout/SessionSummary'

import { DangerButton } from './DangerButton'
import { DeleteSessionSheet } from './DeleteSessionSheet'
import { HistoryLink } from './HistoryLink'
import { byExercise, DELETE_HINT, rowTitle, setText, WORKOUTS_PATH } from './historyText'
import { TrashIcon } from './icons'

import type { Discard } from './DeleteSessionSheet'
import type { FoundSession } from './useWorkoutHistory'

export const UNKNOWN_EXERCISE = 'Unknown exercise'

export type SessionDetailProps = { view: FoundSession; discard?: Discard }

export function backToList(): void {
  window.history.pushState(null, '', WORKOUTS_PATH)
}

export function SessionDetail({ view, discard }: SessionDetailProps) {
  const { session, sets, stats, exercises, unit } = view
  const [deleting, setDeleting] = useState(false)
  const nameOf = (exerciseId: string) => exercises.get(exerciseId)?.name ?? UNKNOWN_EXERCISE
  const cells = [
    { label: 'duration', value: formatDuration(stats.durationSeconds, 'short') },
    ...summaryCells(stats, unit),
  ]
  const hasRecords = stats.newRecords.length > 0

  return (
    <div className="mt-6 flex flex-col gap-3">
      <HistoryLink
        href={WORKOUTS_PATH}
        className="text-accent inline-flex min-h-11 items-center gap-1 self-start text-[15px] font-bold"
      >
        <span aria-hidden="true">‹</span> All sessions
      </HistoryLink>
      <h2 className="text-text text-[19px] leading-tight font-bold tracking-[-0.6px]">
        {rowTitle(session)}
      </h2>

      <div className={cn('grid grid-cols-1 items-start gap-3', hasRecords && 'md:grid-cols-2')}>
        <Card>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cells.map((cell) => (
              <div key={cell.label} className="flex min-w-0 flex-col-reverse">
                <dt className="text-muted text-xs">{cell.label}</dt>
                <dd className="text-text text-[19px] leading-tight font-bold tracking-[-0.6px] break-words">
                  {cell.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {hasRecords ? (
          <Card>
            <h3>
              <MicroLabel>New records</MicroLabel>
            </h3>
            <ul className="mt-1.5">
              {stats.newRecords.map((record) => (
                <li
                  key={record.exerciseId}
                  className="border-border flex min-h-11 items-center justify-between gap-3 border-b last:border-b-0"
                >
                  <span className="text-muted min-w-0 text-sm break-words">
                    {nameOf(record.exerciseId)}
                  </span>
                  <strong className="text-accent shrink-0 text-sm">
                    {recordText(record, unit)}
                  </strong>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        {byExercise(sets).map((group) => (
          <Card key={group.exerciseId} role="region" aria-label={nameOf(group.exerciseId)}>
            <h3 className="text-text text-[15px] font-bold break-words">
              {nameOf(group.exerciseId)}
            </h3>
            <ol className="mt-1.5">
              {group.sets.map((set, index) => (
                <li
                  key={set.id}
                  className="border-border flex min-h-11 items-center justify-between gap-3 border-b last:border-b-0"
                >
                  <span className="text-muted text-sm">Set {index + 1}</span>
                  <strong className="text-text shrink-0 text-sm">{setText(set, unit)}</strong>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex max-w-sm flex-col gap-2">
        <DangerButton
          onClick={() => {
            setDeleting(true)
          }}
        >
          <TrashIcon className="size-[18px]" />
          Delete session
        </DangerButton>
        <p className="text-muted text-[13px]">{DELETE_HINT}</p>
      </div>

      <DeleteSessionSheet
        target={deleting ? { session, stats } : null}
        unit={unit}
        discard={discard}
        onDeleted={backToList}
        onClose={() => {
          setDeleting(false)
        }}
      />
    </div>
  )
}
