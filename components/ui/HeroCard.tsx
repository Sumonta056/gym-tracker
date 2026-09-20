import { cn } from './cn'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type HeroCardProps = ComponentPropsWithoutRef<'section'> & {
  label?: ReactNode
}

export function HeroCard({ label, className, children, ...rest }: HeroCardProps) {
  return (
    <section className={cn('bg-accent text-accent-ink rounded-hero p-5', className)} {...rest}>
      {label === undefined ? null : (
        <span className="text-accent-ink/70 block text-[10px] leading-4 font-bold tracking-[1.5px] uppercase">
          {label}
        </span>
      )}
      {children}
    </section>
  )
}
