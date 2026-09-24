'use client'

import { useId } from 'react'

import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export const FIELD_INPUT_CLASS =
  'bg-surface text-text placeholder:text-dim rounded-input h-[52px] w-full border px-3.5 text-base font-semibold placeholder:font-medium'

export type FieldProps = ComponentPropsWithoutRef<'input'> & {
  label: string
  hint?: ReactNode
  error?: string
  adornment?: ReactNode
  wrapperClassName?: string
}

export function Field({
  label,
  hint,
  error,
  adornment,
  wrapperClassName,
  id,
  className,
  ...rest
}: FieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = cn(
    hint === undefined ? undefined : hintId,
    error === undefined ? undefined : errorId,
  )

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-[7px]', wrapperClassName)}>
      <MicroLabel as="label" htmlFor={inputId}>
        {label}
        {typeof adornment === 'string' ? <span className="sr-only">{`, ${adornment}`}</span> : null}
      </MicroLabel>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          className={cn(
            FIELD_INPUT_CLASS,
            adornment === undefined ? '' : 'pr-14',
            error === undefined ? 'border-border' : 'border-danger',
            className,
          )}
          {...rest}
        />
        {adornment === undefined ? null : (
          <span
            aria-hidden="true"
            className="text-muted pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm"
          >
            {adornment}
          </span>
        )}
      </div>
      {hint === undefined ? null : (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
