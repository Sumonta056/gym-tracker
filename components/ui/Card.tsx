import { cn } from './cn'

import type { ComponentPropsWithoutRef } from 'react'

export type CardProps = ComponentPropsWithoutRef<'div'> & {
  selected?: boolean
}

export function Card({ selected = false, className, children, ...rest }: CardProps) {
  return (
    <div
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'bg-surface rounded-card border p-4',
        selected ? 'border-accent' : 'border-border',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
