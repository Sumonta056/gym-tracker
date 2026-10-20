import { cn } from '../ui/cn'

import type { PlanVideo } from '../../lib/schema/plan'

export const WATCH_TEXT = 'Tutorial on YouTube'

export type WatchPillProps = {
  name: string
  video: PlanVideo
  className?: string
}

export function WatchPill({ name, video, className }: WatchPillProps) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener"
      aria-label={`${WATCH_TEXT}: ${name}, opens a new tab`}
      className={cn(
        'border-border bg-surface-2 text-text inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-bold',
        className,
      )}
    >
      <span aria-hidden="true">▶</span>
      {WATCH_TEXT}
    </a>
  )
}
