import { openTarget } from '../../lib/links/openTarget'
import { cn } from '../ui/cn'

import { CategoryDot } from './CategoryChips'
import { VideoMenu } from './VideoMenu'

import type { ListedVideo } from '../../lib/db/repository'
import type { Priority } from '../../lib/schema/savedVideo'

const BADGE: Record<Priority, { label: string; className: string } | null> = {
  high: { label: 'High', className: 'bg-accent text-accent-ink' },
  normal: null,
  low: { label: 'Low', className: 'bg-surface-2 text-muted' },
}

export type VideoCardProps = {
  video: ListedVideo
  standalone: boolean
  onEdit: () => void
  onDelete: () => void
}

export function VideoCard({ video, standalone, onEdit, onDelete }: VideoCardProps) {
  const { href, target } = openTarget(video.url, { standalone })
  const badge = BADGE[video.priority]

  return (
    <li className="bg-surface border-border rounded-card flex min-w-0 items-center border">
      <a
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        className="rounded-l-card block min-h-11 min-w-0 flex-1 py-3.5 pr-1 pl-4"
      >
        <span
          className={cn(
            'block text-base leading-tight font-bold [overflow-wrap:anywhere] break-words',
            video.priority === 'low' ? 'text-muted' : 'text-text',
          )}
        >
          {video.title}
        </span>
        <span className="text-muted mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {badge === null ? null : (
            <span
              className={cn('rounded-full px-2 py-0.5 text-[11px] font-extrabold', badge.className)}
            >
              {badge.label}
            </span>
          )}
          {video.category === null ? null : (
            <span
              data-testid="video-category"
              className="text-text inline-flex min-w-0 items-center gap-1.5 font-semibold [overflow-wrap:anywhere] break-words"
            >
              <CategoryDot color={video.category.color} />
              {video.category.name}
            </span>
          )}
          {video.category !== null && video.tags.length > 0 ? (
            <span aria-hidden="true">·</span>
          ) : null}
          {video.tags.map((tag) => (
            <span key={tag} className="min-w-0 [overflow-wrap:anywhere] break-words">
              #{tag}
            </span>
          ))}
        </span>
      </a>
      <VideoMenu title={video.title} onEdit={onEdit} onDelete={onDelete} />
    </li>
  )
}
