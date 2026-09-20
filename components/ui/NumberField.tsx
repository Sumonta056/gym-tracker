'use client'

import { useId } from 'react'

import { cn } from './cn'

import type { ComponentPropsWithoutRef } from 'react'

export type NumberFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  label: string
  unit?: string
  hint?: string
  error?: string
}

export function NumberField({
  label,
  unit,
  hint,
  error,
  id,
  className,
  inputMode = 'decimal',
  ...rest
}: NumberFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = cn(
    hint === undefined ? undefined : hintId,
    error === undefined ? undefined : errorId,
  )

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-muted text-[10px] font-bold tracking-[1.5px] uppercase"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode={inputMode}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          className={cn(
            'bg-surface text-text placeholder:text-dim rounded-input h-[52px] w-full border px-4 text-base',
            unit === undefined ? '' : 'pr-14',
            error === undefined ? 'border-border' : 'border-danger',
            className,
          )}
          {...rest}
        />
        {unit === undefined ? null : (
          <span
            aria-hidden="true"
            className="text-muted pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm"
          >
            {unit}
          </span>
        )}
      </div>
      {hint === undefined ? null : (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
