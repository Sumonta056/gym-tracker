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
        'bg-accent text-accent-ink rounded-input inline-flex h-[54px] w-full items-center justify-center px-5 text-base font-extrabold disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
