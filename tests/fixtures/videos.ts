import type { VideoCategory } from '../../lib/db/dexie'
import type { ListedVideo } from '../../lib/db/repository'

const STAMP = '2026-10-20T09:00:00.000Z'

export function sampleCategory(
  name: string,
  color: VideoCategory['color'],
  id = `category-${name.toLowerCase().replace(/\s+/g, '-')}`,
): VideoCategory {
  return { id, name, color, created_at: STAMP, updated_at: STAMP, deleted_at: null }
}

export function sampleVideo(
  title: string,
  options: Partial<Omit<ListedVideo, 'title'>> = {},
): ListedVideo {
  const category = options.category === undefined ? null : options.category

  return {
    id: `video-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    url: 'https://www.youtube.com/watch?v=abc',
    title,
    category_id: category?.id ?? 'category-missing',
    tags: [],
    priority: 'normal',
    created_at: STAMP,
    updated_at: STAMP,
    deleted_at: null,
    ...options,
    category,
  }
}
