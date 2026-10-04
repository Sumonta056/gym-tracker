'use client'

import { useId } from 'react'

import { formatDuration } from '../../lib/duration'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'

import type { DurationReading } from '../../lib/csv/import'
import type { ReactNode } from 'react'

export type BadgeTone = 'default' | 'warn' | 'danger'

const BADGE_TONE: Record<BadgeTone, string> = {
  default: 'border-border bg-surface-2 text-muted',
  warn: 'bg-warn/16 text-warn border-transparent',
  danger: 'border-border bg-surface-2 text-danger',
}

export function Badge({ tone = 'default', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <MicroLabel
      tone="inherit"
      tracking="tab"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border px-[7px] py-[3px] font-extrabold whitespace-nowrap',
        BADGE_TONE[tone],
      )}
    >
      {children}
    </MicroLabel>
  )
}

export const CELL_CLASS =
  'bg-surface-2 flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[15px] font-bold'

export function ReviewValue({ raw, picked }: { raw: string; picked: string | null }) {
  if (picked !== null) {
    return <span className={cn(CELL_CLASS, 'border-border')}>{picked}</span>
  }

  return (
    <span className={cn(CELL_CLASS, 'border-warn justify-between')}>
      {raw}
      <Badge tone="warn">Check</Badge>
    </span>
  )
}

export function readingText(raw: string, reading: DurationReading, index: number) {
  const minsec = formatDuration(reading.seconds, 'minsec')

  if (index === 0) {
    return { main: minsec, spoken: 'read as minutes and seconds', caption: 'as mm.ss' }
  }

  return {
    main: `${raw} min`,
    spoken: `read as decimal minutes, ${minsec}`,
    caption: `as minutes · ${minsec}`,
  }
}

export type ReviewCellProps = {
  label: string
  raw: string
  readings: DurationReading[]
  pick: number | undefined
  onPick: (reading: number) => void
  similar: number
  others: number
  onApplySimilar: () => void
}

export function ReviewCell({
  label,
  raw,
  readings,
  pick,
  onPick,
  similar,
  others,
  onApplySimilar,
}: ReviewCellProps) {
  const legendId = useId()

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <fieldset aria-labelledby={legendId} className="m-0 min-w-0 border-0 p-0">
        <legend id={legendId} className="text-muted mb-2 p-0 text-[13px]">
          {`${label} ${raw} reads two ways. Pick one.`}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {readings.map((reading, index) => {
            const text = readingText(raw, reading, index)
            const pressed = pick === index

            return (
              <div key={text.caption} className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => {
                    onPick(index)
                  }}
                  className={cn(
                    'min-h-11 rounded-full border px-4 text-[13px] font-bold whitespace-nowrap',
                    pressed
                      ? 'bg-accent border-accent text-accent-ink'
                      : 'bg-surface-2 border-border text-muted',
                  )}
                >
                  {text.main}
                  <span className="sr-only">{`, ${text.spoken}`}</span>
                </button>
                <span aria-hidden="true" className="text-muted text-center text-xs">
                  {text.caption}
                </span>
              </div>
            )
          })}
        </div>
      </fieldset>
      {others === 0 ? null : (
        <SecondaryButton
          className="min-h-11!"
          disabled={pick === undefined || similar === 0}
          onClick={onApplySimilar}
        >
          {`Apply to all similar · ${String(similar)} more`}
        </SecondaryButton>
      )}
    </div>
  )
}
