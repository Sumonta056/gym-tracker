'use client'

import { useEffect, useState } from 'react'

import { formatDuration } from '../../lib/duration'

import type { ComponentPropsWithoutRef } from 'react'

export const TICK_MS = 1000

export function systemNow(): Date {
  return new Date()
}

export function elapsedSeconds(startedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(startedAt)) / 1000))
}

export function startedText(startedAt: string): string {
  return new Date(startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export type SessionTimerProps = Omit<ComponentPropsWithoutRef<'p'>, 'children'> & {
  startedAt: string
  now?: () => Date
}

export function SessionTimer({ startedAt, now = systemNow, ...rest }: SessionTimerProps) {
  const [instant, setInstant] = useState(now)

  useEffect(() => {
    setInstant(now())
    const timer = setInterval(() => {
      setInstant(now())
    }, TICK_MS)

    return () => {
      clearInterval(timer)
    }
  }, [now])

  return (
    <p role="timer" {...rest}>
      {formatDuration(elapsedSeconds(startedAt, instant), 'clock')}
    </p>
  )
}
