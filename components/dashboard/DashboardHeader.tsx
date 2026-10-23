'use client'

import { useRef, useState } from 'react'

import { dayPath, parseLogDate, shiftLogDate } from '../../lib/format/logDate'
import { toDayNumber } from '../../lib/metrics/day'
import { isTypingKey, prettyDate } from '../DailyEntryForm'
import { ProfileAvatarLink } from '../profile/ProfileAvatarLink'
import { SyncChip } from '../sync/SyncChip'
import { MicroLabel } from '../ui/MicroLabel'
import { StatIcon } from '../ui/StatIcon'

import { headerDate } from './summary'

export type DashboardHeaderProps = {
  date: string
  today: string
}

export const DAY_PICKER_ID = 'dashboard-day'

const DAY_STEP =
  'bg-surface-2 border-border text-text rounded-input inline-flex h-[52px] w-11 shrink-0 items-center justify-center border text-xl font-bold disabled:opacity-50'

export function microLabel(date: string, today: string): string {
  const { weekday } = headerDate(date)

  return date === today ? `Today · ${weekday}` : weekday
}

export function openDay(path: string): void {
  window.history.pushState(null, '', path)
}

export function DashboardHeader({ date, today }: DashboardHeaderProps) {
  const { dayMonth, short } = headerDate(date)
  const previous = shiftLogDate(date, -1)
  const next = shiftLogDate(date, 1)
  const [text, setText] = useState(date)
  const [seen, setSeen] = useState(date)
  const typing = useRef(false)
  const picker = useRef<HTMLInputElement>(null)

  if (seen !== date) {
    setSeen(date)
    setText(date)
  }

  function go(target: string): void {
    if (target === date) {
      return
    }

    if (target >= today) {
      picker.current?.focus()
    }

    openDay(dayPath(target, today))
  }

  function commit(value: string): void {
    if (toDayNumber(value) === null) {
      setText(date)
      return
    }

    const picked = parseLogDate(value, today)

    if (picked === date) {
      setText(date)
      return
    }

    go(picked)
  }

  return (
    <header className="flex items-center justify-between gap-3">
      <div
        role="group"
        aria-label="Choose the day"
        className="flex min-w-0 items-center gap-2 md:max-w-sm"
      >
        <button
          type="button"
          aria-label={`Previous day, ${prettyDate(previous)}`}
          onClick={() => {
            go(previous)
          }}
          className={DAY_STEP}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div
          data-testid="day-picker"
          className="focus-within:outline-accent relative flex min-h-11 min-w-0 flex-col justify-center rounded-lg px-1.5 focus-within:outline-2 focus-within:outline-offset-2"
        >
          <MicroLabel as="p">{microLabel(date, today)}</MicroLabel>
          <h1 className="text-text flex items-center gap-1.5 text-[23px] leading-tight font-bold tracking-[-0.6px] whitespace-nowrap">
            <span aria-hidden="true" className="md:hidden">
              {short}
            </span>
            <span className="sr-only md:not-sr-only">{dayMonth}</span>
            <StatIcon name="calendar" className="text-muted size-[15px]" />
          </h1>
          <input
            ref={picker}
            id={DAY_PICKER_ID}
            type="date"
            aria-label="Day"
            max={today}
            value={text}
            onChange={(event) => {
              const value = event.currentTarget.value

              setText(value)

              if (!typing.current) {
                commit(value)
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                typing.current = false
                commit(event.currentTarget.value)
              } else if (isTypingKey(event.key)) {
                typing.current = true
              }
            }}
            onKeyUp={() => {
              typing.current = false
            }}
            onBlur={(event) => {
              typing.current = false
              commit(event.currentTarget.value)
            }}
            className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
          />
        </div>
        <button
          type="button"
          aria-label={`Next day, ${prettyDate(next)}`}
          disabled={date >= today}
          onClick={() => {
            go(next)
          }}
          className={DAY_STEP}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SyncChip />
        <ProfileAvatarLink />
      </div>
    </header>
  )
}
