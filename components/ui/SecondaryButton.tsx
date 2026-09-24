import { cn } from './cn'

import type { ComponentPropsWithoutRef } from 'react'

export type SecondaryButtonTone = 'default' | 'danger'

export type SecondaryButtonProps = ComponentPropsWithoutRef<'button'> & {
  tone?: SecondaryButtonTone
}

const TONE_CLASS: Record<SecondaryButtonTone, string> = {
  default: 'text-text',
  danger: 'text-danger',
}

export function SecondaryButton({
  className,
  children,
  type = 'button',
  tone = 'default',
  ...rest
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'bg-surface-2 border-border rounded-input inline-flex min-h-[54px] w-full items-center justify-center gap-2 border px-4 text-[15px] font-bold tracking-[-0.2px] disabled:opacity-50',
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
