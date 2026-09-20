'use client'

import { cn } from './cn'

export type SegmentedTabOption<Value extends string> = {
  value: Value
  label: string
}

export type SegmentedTabsProps<Value extends string> = {
  label: string
  options: SegmentedTabOption<Value>[]
  value: Value
  onValueChange: (value: Value) => void
  className?: string
}

export function SegmentedTabs<Value extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
}: SegmentedTabsProps<Value>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'bg-surface border-border inline-flex w-full gap-1 rounded-full border p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onValueChange(option.value)
            }}
            className={cn(
              'h-11 flex-1 rounded-full px-4 text-sm font-bold',
              selected ? 'bg-accent text-accent-ink' : 'text-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
