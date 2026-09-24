import { cn } from './cn'

import type { ComponentPropsWithoutRef } from 'react'

export type PrimaryButtonProps = ComponentPropsWithoutRef<'button'>

export function PrimaryButton({
  className,
  children,
  type = 'button',
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'bg-accent text-accent-ink border-accent rounded-input inline-flex min-h-[54px] w-full items-center justify-center gap-2 border px-4 text-[15px] font-bold tracking-[-0.2px] disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
