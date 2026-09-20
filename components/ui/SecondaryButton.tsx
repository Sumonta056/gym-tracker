import { cn } from './cn'

import type { ComponentPropsWithoutRef } from 'react'

export type SecondaryButtonProps = ComponentPropsWithoutRef<'button'>

export function SecondaryButton({
  className,
  children,
  type = 'button',
  ...rest
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'bg-surface-2 text-text border-border rounded-input inline-flex h-[54px] w-full items-center justify-center border px-5 text-base font-bold disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
