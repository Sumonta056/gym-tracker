import type { SavedVideo } from '../db/dexie'
import type { ListedVideo } from '../db/repository'
import type { Priority } from '../schema/savedVideo'
import type { CategoryColor } from '../schema/videoCategory'

export const ALL = 'all'

export type CategoryChip = {
  id: string
  name: string
  color: CategoryColor | null
  count: number
}

const RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 }

function byText(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  return left < right ? -1 : 1
}

export function byPriorityThenNewest(left: SavedVideo, right: SavedVideo): number {
  return (
    RANK[left.priority] - RANK[right.priority] ||
    byText(right.created_at, left.created_at) ||
    byText(left.id, right.id)
  )
}

export function matchesSearch(video: ListedVideo, query: string): boolean {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return true
  }

  const tagNeedle = needle.replace(/^#+/, '')

  return (
    video.title.toLowerCase().includes(needle) ||
    video.tags.some((tag) => tagNeedle !== '' && tag.includes(tagNeedle))
  )
}

export function categoryChips(videos: ListedVideo[]): CategoryChip[] {
  const chips = new Map<string, CategoryChip>()

  for (const video of videos) {
    const { category } = video

    if (category === null) {
      continue
    }

    const chip = chips.get(category.id)

    if (chip === undefined) {
      chips.set(category.id, {
        id: category.id,
        name: category.name,
        color: category.color,
        count: 1,
      })
    } else {
      chip.count += 1
    }
  }

  const named = [...chips.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
      byText(left.id, right.id),
  )

  return [{ id: ALL, name: 'All', color: null, count: videos.length }, ...named]
}

export function visibleVideos(
  videos: ListedVideo[],
  filter: { categoryId: string; query: string },
): ListedVideo[] {
  return videos.filter(
    (video) =>
      (filter.categoryId === ALL || video.category?.id === filter.categoryId) &&
      matchesSearch(video, filter.query),
  )
}
