'use client'

import { motion } from 'motion/react'
import { useState } from 'react'

import { prefersReducedMotion } from '../motion/reducedMotion'
import { cn } from '../ui/cn'

import type { StepStatus } from '../../lib/metrics/planProgress'

export const FILL_SECONDS = 1.4

const STATUS_WORD: Record<StepStatus, string> = {
  done: 'done',
  skipped: 'skipped',
  now: 'now',
  todo: 'to do',
}

const STATUS_CLASS: Record<StepStatus, string> = {
  done: 'bg-accent',
  skipped: 'bg-dim',
  now: 'bg-surface-2',
  todo: 'bg-surface-2',
}

export function stepLabel(index: number, name: string, status: StepStatus): string {
  return `Step ${String(index + 1)}, ${name}: ${STATUS_WORD[status]}`
}

export type StepProgressProps = {
  names: readonly string[]
  statuses: readonly StepStatus[]
  className?: string
}

function NowFill() {
  const [still] = useState(prefersReducedMotion)

  if (still) {
    return (
      <span
        aria-hidden="true"
        data-fill="still"
        className="bg-accent absolute inset-0 origin-left scale-x-50"
      />
    )
  }

  return (
    <motion.span
      aria-hidden="true"
      data-fill="moving"
      className="bg-accent absolute inset-0 origin-left"
      initial={{ scaleX: 0.15 }}
      animate={{ scaleX: 0.95 }}
      transition={{
        duration: FILL_SECONDS,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'reverse',
      }}
    />
  )
}

export function StepProgress({ names, statuses, className }: StepProgressProps) {
  return (
    <ol aria-label="Steps" className={cn('flex gap-1', className)}>
      {statuses.map((status, index) => (
        <li
          key={`${String(index)}-${names[index] ?? ''}`}
          data-state={status}
          className={cn(
            'relative h-[5px] flex-1 overflow-hidden rounded-full',
            STATUS_CLASS[status],
          )}
        >
          {status === 'now' ? <NowFill /> : null}
          <span className="sr-only">{stepLabel(index, names[index] ?? '', status)}</span>
        </li>
      ))}
    </ol>
  )
}
