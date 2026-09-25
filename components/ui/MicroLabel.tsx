import { cn } from './cn'

import type { HTMLAttributes } from 'react'

export type MicroLabelTone = 'muted' | 'accent-ink' | 'inherit'

export type MicroLabelElement = 'span' | 'label' | 'p'

export type MicroLabelTracking = 'label' | 'tab'

const TONE_CLASS: Record<MicroLabelTone, string> = {
  muted: 'text-muted',
  'accent-ink': 'text-accent-ink/70',
  inherit: '',
}

const TRACKING_CLASS: Record<MicroLabelTracking, string> = {
  label: 'tracking-[1.5px]',
  tab: 'tracking-[0.6px]',
}

export type MicroLabelProps = HTMLAttributes<HTMLElement> & {
  as?: MicroLabelElement
  tone?: MicroLabelTone
  tracking?: MicroLabelTracking
  htmlFor?: string
}

export function MicroLabel({
  as = 'span',
  tone = 'muted',
  tracking = 'label',
  htmlFor,
  className,
  children,
  ...rest
}: MicroLabelProps) {
  const classes = cn(
    'block text-[10px] leading-4 font-bold uppercase',
    TRACKING_CLASS[tracking],
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
