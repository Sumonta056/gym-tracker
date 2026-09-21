'use client'

import { useState } from 'react'

import { formatDuration, parseDuration } from '../../lib/duration'

import { Field } from './Field'

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
    <Field
      label={label}
      id={id}
      name={name}
      type="text"
      inputMode="text"
      autoComplete="off"
      placeholder="1:12:05"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      hint={hint}
      error={error ?? undefined}
      wrapperClassName={className}
    />
  )
}
