import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type HeroCardProps = ComponentPropsWithoutRef<'section'> & {
  label?: ReactNode
}

export function HeroCard({ label, className, children, ...rest }: HeroCardProps) {
  return (
    <section className={cn('bg-accent text-accent-ink rounded-hero p-5', className)} {...rest}>
      {label === undefined ? null : <MicroLabel tone="accent-ink">{label}</MicroLabel>}
      {children}
    </section>
  )
}
