import { cn } from '../ui/cn'

import type { PlanVideo } from '../../lib/schema/plan'

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
      aria-label={`Watch ${name}`}
      className={cn(
        'border-border bg-surface-2 text-text inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border px-4 text-[13px] font-bold',
        className,
      )}
    >
      <span aria-hidden="true">▶</span>
    </a>
  )
}
