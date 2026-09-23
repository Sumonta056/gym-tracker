'use client'

import { formatDuration, parseInput } from '../../lib/duration'

import { Field } from './Field'

import type { ComponentPropsWithoutRef } from 'react'

export const DURATION_HINT = 'Accepts 1:12:05, 72m or 1h 12m.'

export type DurationFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  label: string
  hint?: string
  error?: string
}

export function durationPreview(text: string): string | null {
  const raw = text.trim()

  if (raw === '') {
    return null
  }

  const parsed = parseInput(raw)

  if (!parsed.ok) {
    return null
  }

  return `${formatDuration(parsed.seconds, 'clock')} · ${formatDuration(parsed.seconds, 'short')}`
}

export function DurationField({ hint = DURATION_HINT, value, ...rest }: DurationFieldProps) {
  const preview = durationPreview(typeof value === 'string' ? value : '')

  return (
    <Field
      type="text"
      inputMode="text"
      autoComplete="off"
      placeholder="1:12:05"
      value={value}
      hint={
        <>
          {hint}
          {preview === null ? null : (
            <span className="text-text mt-1 block font-semibold">{preview}</span>
          )}
        </>
      }
      {...rest}
    />
  )
}
