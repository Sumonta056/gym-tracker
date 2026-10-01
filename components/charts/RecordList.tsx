'use client'

import { formatLoadShort, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { localDate } from '../../lib/schema/dailyEntry'
import { formatCount } from '../dashboard/summary'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { RecordBadge, repsText } from '../workout/SetRow'

import { formatKg } from './rangeData'

import type { LiftRecord } from './liftData'
import type { UnitSystem } from '../../lib/schema/profile'

export type RecordListProps = {
  records: LiftRecord[]
  today: string
  unit?: UnitSystem
  className?: string
}

export const NEW_TODAY = 'New today'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function recordDay(at: string): string {
  return localDate(new Date(at))
}

export function shortDate(date: string): string {
  return `${String(Number(date.slice(8, 10)))} ${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''}`
}

export function recordDetail(record: LiftRecord, unit: UnitSystem): string {
  const symbol = weightSymbol(unit)
  const volume = `best volume ${formatCount(Math.round(toDisplayWeight(record.volumeKg, unit)))} ${symbol}`

  if (record.oneRepMaxKg === null) {
    return volume
  }

  return `est. 1RM ${formatKg(toDisplayWeight(record.oneRepMaxKg, unit))} ${symbol} · ${volume}`
}

export function RecordList({ records, today, unit = 'metric', className }: RecordListProps) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex min-h-11 items-center">
        <h2>
          <MicroLabel>Personal records</MicroLabel>
        </h2>
      </div>

      {records.length === 0 ? (
        <p className="text-muted text-sm">Finish a set with a load to see your records.</p>
      ) : (
        <ul>
          {records.map((record) => {
            const day = recordDay(record.at)

            return (
              <li
                key={record.exerciseId}
                className="border-border flex items-center justify-between gap-3 border-b py-1.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-text text-sm font-bold">{record.name}</p>
                  <p className="text-muted text-xs">{recordDetail(record, unit)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-text text-sm font-bold">
                    <span aria-hidden="true">
                      {`${formatLoadShort(record.loadKg, unit)} × ${String(record.reps)}`}
                    </span>
                    <span className="sr-only">{`Best load ${formatLoadShort(record.loadKg, unit)} ${weightSymbol(unit)} for ${repsText(record.reps)}`}</span>
                  </p>
                  {day === today ? (
                    <RecordBadge label={NEW_TODAY} />
                  ) : (
                    <p className="text-muted text-xs">{shortDate(day)}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
