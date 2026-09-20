import { cn } from './cn'

import type { ComponentPropsWithoutRef } from 'react'

export type MicroLabelProps = ComponentPropsWithoutRef<'span'>

export function MicroLabel({ className, children, ...rest }: MicroLabelProps) {
  return (
    <span
      className={cn(
        'text-muted block text-[10px] leading-4 font-bold tracking-[1.5px] uppercase',
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
