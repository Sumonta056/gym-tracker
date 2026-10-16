'use client'

import { useId, useRef } from 'react'

import { formatDuration } from '../../lib/duration'
import { formatLoadShort, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { formatCount } from '../dashboard/summary'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SheetModal } from '../ui/SheetModal'

import type { SessionRecord, SessionStats } from '../../lib/metrics/sessionStats'
import type { UnitSystem } from '../../lib/schema/profile'

export const SUMMARY_TITLE = 'Session done'

export const NO_RECORD = 'No new record this time.'

export type SummaryCell = { label: string; value: string }

export function summaryCells(stats: SessionStats, unit: UnitSystem): SummaryCell[] {
  return [
    { label: 'sets', value: String(stats.setCount) },
    { label: 'exercises', value: String(stats.exerciseCount) },
    {
      label: `volume (${weightSymbol(unit)})`,
      value: formatCount(Math.round(toDisplayWeight(stats.volumeKg, unit))),
    },
  ]
}

export function recordText(record: SessionRecord, unit: UnitSystem): string {
  return `${formatLoadShort(record.weightKg, unit)} ${weightSymbol(unit)} × ${String(record.reps)}`
}

export type SessionSummaryProps = {
  stats: SessionStats | null
  unit: UnitSystem
  nameOf: (exerciseId: string) => string
  onDone: () => void
}

export function SessionSummary({ stats, unit, nameOf, onDone }: SessionSummaryProps) {
  const numbersId = useId()
  const finished = useRef<SessionStats | null>(null)

  const finish = () => {
    if (stats === null || finished.current === stats) {
      return
    }

    finished.current = stats
    onDone()
  }

  return (
    <SheetModal
      open={stats !== null}
      title={SUMMARY_TITLE}
      onClose={finish}
      describedBy={numbersId}
    >
      {stats === null ? null : (
        <div className="flex flex-col gap-3">
          <div id={numbersId} className="flex flex-col gap-3">
            <div>
              <MicroLabel as="p">Duration</MicroLabel>
              <p className="text-text mt-1 text-[48px] leading-none font-extrabold tracking-[-2.4px]">
                {formatDuration(stats.durationSeconds, 'clock')}
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-3">
              {summaryCells(stats, unit).map((cell) => (
                <div key={cell.label} className="flex min-w-0 flex-col-reverse">
                  <dt className="text-muted text-xs">{cell.label}</dt>
                  <dd className="text-text text-[19px] leading-tight font-bold tracking-[-0.6px] break-words">
                    {cell.value}
                  </dd>
                </div>
              ))}
            </dl>

            <Card>
              <h3>
                <MicroLabel>New records</MicroLabel>
              </h3>
              {stats.newRecords.length === 0 ? (
                <p className="text-muted mt-1.5 text-sm">{NO_RECORD}</p>
              ) : (
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
              )}
            </Card>
          </div>

          <PrimaryButton onClick={finish}>Done</PrimaryButton>
        </div>
      )}
    </SheetModal>
  )
}
