'use client'

import { useEffect, useRef, useState } from 'react'

import { formatDuration } from '../../lib/duration'
import {
  remainingSeconds,
  restEndsAt,
  restProgress,
  restTotalSeconds,
} from '../../lib/workout/restTimer'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'

import { systemNow, TICK_MS } from './SessionTimer'

export const REST_OVER = 'Rest over. Start the next set.'

const PILL =
  'bg-surface-2 border-border text-muted inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-[13px] font-bold whitespace-nowrap'

type Phase = 'running' | 'over' | 'idle'

export function restLengthText(exerciseName: string, seconds: number): string {
  return `${exerciseName} rests ${formatDuration(seconds, 'clock')}`
}

export type RestTimerCardProps = {
  exerciseName: string
  completedAt: string
  restSeconds: number
  savedSeconds: number
  extraTaps: number
  now?: () => Date
  onZero: () => void
  onSkip: () => void
  onAddThirty: () => void
  onChange: () => void
  className?: string
}

export function RestTimerCard({
  exerciseName,
  completedAt,
  restSeconds,
  savedSeconds,
  extraTaps,
  now = systemNow,
  onZero,
  onSkip,
  onAddThirty,
  onChange,
  className,
}: RestTimerCardProps) {
  const endsAt = restEndsAt(completedAt, restSeconds, extraTaps)
  const [instant, setInstant] = useState(now)
  const [phase, setPhase] = useState<Phase>(() =>
    remainingSeconds(endsAt, instant) > 0 ? 'running' : 'idle',
  )
  const phaseRef = useRef(phase)
  const latest = useRef({ endsAt, onZero })

  useEffect(() => {
    latest.current = { endsAt, onZero }
  })

  useEffect(() => {
    const tick = () => {
      const at = now()

      setInstant(at)

      if (phaseRef.current === 'running' && remainingSeconds(latest.current.endsAt, at) === 0) {
        phaseRef.current = 'over'
        setPhase('over')
        latest.current.onZero()
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }

    tick()
    const timer = setInterval(tick, TICK_MS)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [now])

  if (phase === 'idle') {
    return null
  }

  const over = phase === 'over'
  const remaining = over ? 0 : remainingSeconds(endsAt, instant)
  const total = restTotalSeconds(restSeconds, extraTaps)

  return (
    <Card tone="rest" role="region" aria-label="Rest timer" className={className}>
      <div className="flex items-center justify-between gap-3">
        <MicroLabel>Rest</MicroLabel>
        <span className="text-muted text-xs">{`of ${formatDuration(total, 'clock')}`}</span>
      </div>
      <p
        role="timer"
        aria-label="Rest remaining"
        className="text-data-cyan mt-1.5 text-[34px] leading-[1.05] font-extrabold tracking-[-1.2px]"
      >
        {formatDuration(remaining, 'clock')}
      </p>
      <p aria-live="polite" className={cn('text-text text-sm font-bold', over ? 'mt-1.5' : '')}>
        {over ? REST_OVER : ''}
      </p>
      {over ? null : (
        <>
          <div
            aria-hidden="true"
            className="bg-surface-2 mt-2.5 h-[5px] overflow-hidden rounded-full"
          >
            <div
              data-testid="rest-bar"
              className="bg-data-cyan h-full rounded-full"
              style={{ width: `${String(restProgress(remaining, total))}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-2">
            <button
              type="button"
              onClick={onSkip}
              className={cn(PILL, 'flex-[1_1_calc(50%-6px)] lg:flex-none')}
            >
              Skip <span className="sr-only">rest</span>
            </button>
            <button
              type="button"
              onClick={onAddThirty}
              className={cn(PILL, 'flex-[1_1_calc(50%-6px)] lg:flex-none')}
            >
              +30 s <span className="sr-only">more rest</span>
            </button>
            <p className="text-muted min-w-0 flex-1 text-sm break-words lg:order-first">
              {restLengthText(exerciseName, savedSeconds)}
            </p>
            <button type="button" onClick={onChange} className={cn(PILL, 'shrink-0')}>
              Change <span className="sr-only">{`the rest time for ${exerciseName}`}</span>
            </button>
          </div>
        </>
      )}
    </Card>
  )
}
