import { cn } from './cn'

import type { ComponentPropsWithRef } from 'react'

export type SecondaryButtonTone = 'default' | 'danger'

export type SecondaryButtonSize = 'default' | 'compact'

export type SecondaryButtonProps = ComponentPropsWithRef<'button'> & {
  tone?: SecondaryButtonTone
  size?: SecondaryButtonSize
}

const TONE_CLASS: Record<SecondaryButtonTone, string> = {
  default: 'text-text',
  danger: 'text-danger',
}

const SIZE_CLASS: Record<SecondaryButtonSize, string> = {
  default: 'min-h-[54px] text-[15px]',
  compact: 'min-h-11 text-sm',
}

export function SecondaryButton({
  className,
  children,
  type = 'button',
  tone = 'default',
  size = 'default',
  ...rest
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'bg-surface-2 border-border rounded-input inline-flex w-full items-center justify-center gap-2 border px-4 font-bold tracking-[-0.2px] disabled:opacity-50',
        TONE_CLASS[tone],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
