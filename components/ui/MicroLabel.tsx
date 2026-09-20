import { cn } from './cn'

import type { HTMLAttributes } from 'react'

export type MicroLabelTone = 'muted' | 'accent-ink' | 'inherit'

export type MicroLabelElement = 'span' | 'label' | 'p'

const TONE_CLASS: Record<MicroLabelTone, string> = {
  muted: 'text-muted',
  'accent-ink': 'text-accent-ink/70',
  inherit: '',
}

export type MicroLabelProps = HTMLAttributes<HTMLElement> & {
  as?: MicroLabelElement
  tone?: MicroLabelTone
  htmlFor?: string
}

export function MicroLabel({
  as = 'span',
  tone = 'muted',
  htmlFor,
  className,
  children,
  ...rest
}: MicroLabelProps) {
  const classes = cn(
    'block text-[10px] leading-4 font-bold tracking-[1.5px] uppercase',
    TONE_CLASS[tone],
    className,
  )

  if (as === 'label') {
    return (
      <label htmlFor={htmlFor} className={classes} {...rest}>
        {children}
      </label>
    )
  }

  if (as === 'p') {
    return (
      <p className={classes} {...rest}>
        {children}
      </p>
    )
  }

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  )
}
