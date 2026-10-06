'use client'

import { formatDuration, MAX_DURATION_SECONDS } from '../../lib/duration'

import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

export const DEFAULT_STEP_SECONDS = 15

export const REST_PRESETS = [60, 90, 120, 180] as const

export const SESSION_PRESETS = [1800, 2700, 3600, 5400] as const

export const NOT_SET = 'Not set'

export type DurationPickerProps = {
  id: string
  label: string
  value: number | null
  onChange: (seconds: number | null) => void
  presets: readonly number[]
  step?: number
  min?: number
  max?: number
  allowClear?: boolean
  className?: string
}

const STEP_BUTTON =
  'bg-surface-2 border-border text-text inline-flex size-11 shrink-0 items-center justify-center rounded-full border text-xl font-bold disabled:opacity-50'

const CHIP =
  'inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-[13px] font-bold whitespace-nowrap'

export function clampSeconds(seconds: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, seconds))
}

export function stepSeconds(value: number | null, by: number, min: number, max: number): number {
  return clampSeconds((value ?? min) + by, min, max)
}

export function presetLabel(seconds: number): string {
  return formatDuration(seconds, seconds % 60 === 0 ? 'short' : 'clock')
}

export function stepWords(step: number): string {
  if (step % 60 === 0) {
    const minutes = step / 60

    return minutes === 1 ? '1 minute' : `${String(minutes)} minutes`
  }

  return step === 1 ? '1 second' : `${String(step)} seconds`
}

export function DurationPicker({
  id,
  label,
  value,
  onChange,
  presets,
  step = DEFAULT_STEP_SECONDS,
  min = 0,
  max = MAX_DURATION_SECONDS,
  allowClear = false,
  className,
}: DurationPickerProps) {
  const labelId = `${id}-label`
  const words = stepWords(step)

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={labelId}
      className={cn('flex w-full min-w-0 flex-col gap-[7px]', className)}
    >
      <MicroLabel id={labelId}>{label}</MicroLabel>
      <div className="bg-surface border-border rounded-input flex items-center justify-between gap-2 border p-1">
        <button
          type="button"
          aria-label={`Decrease ${label} by ${words}`}
          disabled={value === null || value <= min}
          onClick={() => {
            onChange(stepSeconds(value, -step, min, max))
          }}
          className={STEP_BUTTON}
        >
          <span aria-hidden="true">−</span>
        </button>
        <output
          className={cn(
            'min-w-0 text-center text-lg font-extrabold tracking-[-0.4px]',
            value === null ? 'text-muted' : 'text-text',
          )}
        >
          {value === null ? NOT_SET : formatDuration(value, 'clock')}
        </output>
        <button
          type="button"
          aria-label={`Increase ${label} by ${words}`}
          disabled={value !== null && value >= max}
          onClick={() => {
            onChange(stepSeconds(value, step, min, max))
          }}
          className={STEP_BUTTON}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const pressed = value === preset

          return (
            <button
              key={preset}
              type="button"
              aria-pressed={pressed}
              onClick={() => {
                onChange(clampSeconds(preset, min, max))
              }}
              className={cn(
                CHIP,
                pressed
                  ? 'bg-accent border-accent text-accent-ink'
                  : 'bg-surface-2 border-border text-muted',
              )}
            >
              {presetLabel(preset)}
            </button>
          )
        })}
        {allowClear && value !== null ? (
          <button
            type="button"
            onClick={() => {
              onChange(null)
            }}
            className={cn(CHIP, 'bg-surface-2 border-border text-text')}
          >
            Clear <span className="sr-only">{label}</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
