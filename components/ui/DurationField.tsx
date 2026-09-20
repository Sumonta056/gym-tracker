'use client'

import { useId, useState } from 'react'

import { formatDuration, parseDuration } from '../../lib/duration'

import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

import type { ChangeEvent, FocusEvent } from 'react'

export type DurationFieldProps = {
  label: string
  value: number | null
  onValueChange: (seconds: number | null) => void
  id?: string
  name?: string
  hint?: string
  className?: string
}

const INVALID = 'Enter a duration such as 1:12:05, 72m or 1h 12m.'

export function DurationField({
  label,
  value,
  onValueChange,
  id,
  name,
  hint = 'Accepts 1:12:05, 72m or 1h 12m.',
  className,
}: DurationFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`

  const [text, setText] = useState(value === null ? '' : formatDuration(value))
  const [error, setError] = useState<string | null>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setText(event.target.value)
    setError(null)
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const raw = event.target.value.trim()

    if (raw === '') {
      setError(null)
      onValueChange(null)
      return
    }

    const seconds = parseDuration(raw)

    if (seconds === null) {
      setError(INVALID)
      onValueChange(null)
      return
    }

    setError(null)
    setText(formatDuration(seconds))
    onValueChange(seconds)
  }

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <MicroLabel as="label" htmlFor={inputId}>
        {label}
      </MicroLabel>
      <input
        id={inputId}
        name={name}
        type="text"
        inputMode="text"
        autoComplete="off"
        placeholder="1:12:05"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={error === null ? hintId : `${hintId} ${errorId}`}
        className={cn(
          'bg-surface text-text placeholder:text-dim rounded-input h-[52px] w-full border px-4 text-base',
          error === null ? 'border-border' : 'border-danger',
        )}
      />
      <p id={hintId} className="text-muted text-xs">
        {hint}
      </p>
      {error === null ? null : (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
