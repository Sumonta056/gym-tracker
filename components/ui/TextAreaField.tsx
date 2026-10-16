'use client'

import { useId } from 'react'

import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export const TEXT_AREA_CLASS =
  'bg-surface text-text placeholder:text-dim rounded-input block max-h-40 min-h-[74px] w-full resize-none border px-3.5 py-3 text-base leading-6 font-semibold [field-sizing:content] placeholder:font-medium'

export type TextAreaFieldProps = ComponentPropsWithoutRef<'textarea'> & {
  label: string
  hint?: ReactNode
  error?: ReactNode
  hideLabel?: boolean
  wrapperClassName?: string
}

export function TextAreaField({
  label,
  hint,
  error,
  hideLabel = false,
  wrapperClassName,
  id,
  rows = 2,
  className,
  ...rest
}: TextAreaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`
  const describedBy = cn(
    hint === undefined ? undefined : hintId,
    error === undefined ? undefined : errorId,
  )

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-[7px]', wrapperClassName)}>
      <MicroLabel as="label" htmlFor={fieldId} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </MicroLabel>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        className={cn(
          TEXT_AREA_CLASS,
          error === undefined ? 'border-border' : 'border-danger',
          className,
        )}
        {...rest}
      />
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
