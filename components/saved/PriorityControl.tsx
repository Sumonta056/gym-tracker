'use client'

import { useId } from 'react'

import { PRIORITIES } from '../../lib/schema/savedVideo'
import { MicroLabel } from '../ui/MicroLabel'

import type { Priority } from '../../lib/schema/savedVideo'

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

export type PriorityControlProps = {
  value: Priority
  onChange: (priority: Priority) => void
}

export function PriorityControl({ value, onChange }: PriorityControlProps) {
  const labelId = useId()
  const name = useId()

  return (
    <div className="flex flex-col gap-[7px]">
      <MicroLabel id={labelId}>Priority</MicroLabel>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="bg-surface border-border flex w-full gap-1 rounded-full border p-1"
      >
        {PRIORITIES.map((priority) => (
          <label
            key={priority}
            className="text-muted has-[:checked]:bg-accent has-[:checked]:text-accent-ink has-[:focus-visible]:outline-accent flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
          >
            <input
              type="radio"
              name={name}
              value={priority}
              checked={value === priority}
              onChange={() => {
                onChange(priority)
              }}
              className="sr-only"
            />
            {PRIORITY_LABEL[priority]}
          </label>
        ))}
      </div>
    </div>
  )
}
