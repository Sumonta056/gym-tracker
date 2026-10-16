import { cn } from '../ui/cn'

import type { ComponentPropsWithoutRef } from 'react'

export type DangerButtonProps = ComponentPropsWithoutRef<'button'>

export function DangerButton({ className, children, type = 'button', ...rest }: DangerButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'bg-danger/15 text-danger border-danger/40 rounded-input inline-flex min-h-[54px] w-full items-center justify-center gap-2 border px-4 text-[15px] font-bold tracking-[-0.2px] disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
