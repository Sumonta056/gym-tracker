import { cn } from './cn'

import type { ReactNode } from 'react'

export type StatIconName =
  | 'steps'
  | 'flame'
  | 'walk'
  | 'swim'
  | 'scale'
  | 'calendar'
  | 'trash'
  | 'clock'
  | 'layers'
  | 'kettlebell'
  | 'dumbbell'
  | 'trophy'
  | 'chevron'

const PATHS: Record<StatIconName, ReactNode> = {
  steps: (
    <>
      <path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0Z" />
      <path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6-1.9 0-2.5 1.8-2.5 3.5 0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0Z" />
    </>
  ),
  flame: (
    <>
      <path d="M12 2c1 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 2 2 2 0 0-2-1-4 0-5z" />
      <path d="M6.5 14.5A6 6 0 0 0 12 22a6 6 0 0 0 5.5-7.5" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="m10 22 2-7 3 3v4" />
      <path d="M8 12.5 10.5 8l3.5 1 2 3.5 2.5 1" />
      <path d="m10.5 8-2 6-2.5 2" />
    </>
  ),
  swim: (
    <>
      <path d="M2 18c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0" />
      <path d="M2 13.5c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0" />
      <circle cx="17" cy="6" r="2" />
      <path d="m6 11 4-4 3 3" />
    </>
  ),
  scale: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0" />
      <path d="m12 10.5 1.5-2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  kettlebell: (
    <>
      <path d="M6 8h12l2 12H4L6 8Z" />
      <circle cx="12" cy="5" r="2" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M6.5 6.5v11" />
      <path d="M17.5 6.5v11" />
      <path d="M3.5 9v6" />
      <path d="M20.5 9v6" />
      <path d="M6.5 12h11" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
}

export type StatIconProps = {
  name: StatIconName
  className?: string
}

export function StatIcon({ name, className }: StatIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      className={cn('size-3.5 shrink-0 fill-none stroke-current', className)}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  )
}
