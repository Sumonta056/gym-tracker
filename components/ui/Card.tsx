import { cn } from './cn'

import type { ComponentPropsWithRef } from 'react'

export type CardTone = 'default' | 'rest'

export type CardProps = ComponentPropsWithRef<'div'> & {
  selected?: boolean
  tone?: CardTone
}

const TONE_FILL: Record<CardTone, string> = {
  default: 'bg-surface',
  rest: 'bg-[color-mix(in_srgb,var(--color-data-cyan)_7%,var(--color-surface))]',
}

const TONE_BORDER: Record<CardTone, string> = {
  default: 'border-border',
  rest: 'border-[color-mix(in_srgb,var(--color-data-cyan)_34%,var(--color-border))]',
}

export function Card({
  selected = false,
  tone = 'default',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      data-selected={selected ? 'true' : undefined}
      data-tone={tone === 'default' ? undefined : tone}
      className={cn(
        'rounded-card border p-4',
        TONE_FILL[tone],
        selected ? 'border-accent' : TONE_BORDER[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
