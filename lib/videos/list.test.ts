import { describe, expect, it } from 'vitest'

import { ALL, byPriorityThenNewest, categoryChips, matchesSearch, visibleVideos } from './list'

import type { SavedVideo, VideoCategory } from '../db/dexie'
import type { ListedVideo } from '../db/repository'

const YOGA = category('11111111-1111-4111-8111-111111111111', 'Yoga', 'data-cyan')
const ARMS = category('22222222-2222-4222-8222-222222222222', 'arms', 'data-pink')

function category(id: string, name: string, color: VideoCategory['color']): VideoCategory {
  return {
    id,
    name,
    color,
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
    deleted_at: null,
  }
}

function video(id: string, overrides: Partial<SavedVideo> = {}): SavedVideo {
  return {
    id,
    url: 'https://youtu.be/x',
    title: 'Hip mobility flow',
    category_id: YOGA.id,
    tags: [],
    priority: 'normal',
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function listed(
  id: string,
  owner: VideoCategory | null,
  overrides: Partial<SavedVideo> = {},
): ListedVideo {
  return {
    ...video(id, {
      category_id: owner?.id ?? '99999999-9999-4999-8999-999999999999',
      ...overrides,
    }),
    category: owner,
  }
}

describe('byPriorityThenNewest', () => {
  it('sorts High, Normal, Low, then newest first', () => {
    const rows = [
      video('a', { priority: 'low', created_at: '2026-10-09T08:00:00.000Z' }),
      video('b', { priority: 'normal', created_at: '2026-10-01T08:00:00.000Z' }),
      video('c', { priority: 'high', created_at: '2026-10-02T08:00:00.000Z' }),
      video('d', { priority: 'normal', created_at: '2026-10-03T08:00:00.000Z' }),
      video('e', { priority: 'high', created_at: '2026-10-04T08:00:00.000Z' }),
    ]

    expect(rows.sort(byPriorityThenNewest).map((row) => row.id)).toEqual(['e', 'c', 'd', 'b', 'a'])
  })

  it('breaks a tie of the same level and time on the id, so the order never flips', () => {
    expect([video('b'), video('a')].sort(byPriorityThenNewest).map((row) => row.id)).toEqual([
      'a',
      'b',
    ])
    expect(byPriorityThenNewest(video('a'), video('a'))).toBe(0)
  })
})

describe('matchesSearch', () => {
  it('matches a title word and a tag, case-insensitive, with the query trimmed', () => {
    const row = listed('a', YOGA, { tags: ['hamstrings'] })

    expect(matchesSearch(row, '  MOBILITY ')).toBe(true)
    expect(matchesSearch(row, 'Hamstr')).toBe(true)
    expect(matchesSearch(row, '#hamstrings')).toBe(true)
    expect(matchesSearch(row, 'squat')).toBe(false)
  })

  it('matches everything for an empty or blank query', () => {
    const row = listed('a', YOGA)

    expect(matchesSearch(row, '')).toBe(true)
    expect(matchesSearch(row, '   ')).toBe(true)
  })
})

describe('categoryChips', () => {
  it('builds "All" first, then each category with 1 or more live videos, A to Z, with counts', () => {
    const rows = [listed('a', YOGA), listed('b', ARMS), listed('c', YOGA)]

    expect(categoryChips(rows)).toEqual([
      { id: ALL, name: 'All', color: null, count: 3 },
      { id: ARMS.id, name: 'arms', color: 'data-pink', count: 1 },
      { id: YOGA.id, name: 'Yoga', color: 'data-cyan', count: 2 },
    ])
  })

  it('counts a video with no category in "All" and gives it no chip', () => {
    expect(categoryChips([listed('a', null), listed('b', YOGA)])).toEqual([
      { id: ALL, name: 'All', color: null, count: 2 },
      { id: YOGA.id, name: 'Yoga', color: 'data-cyan', count: 1 },
    ])
  })

  it('gives 2 categories of the same name 2 chips, in a stable order by id', () => {
    const twin = category('00000000-0000-4000-8000-000000000001', 'yoga', 'data-blue')

    expect(categoryChips([listed('a', YOGA), listed('b', twin)]).map((chip) => chip.id)).toEqual([
      ALL,
      twin.id,
      YOGA.id,
    ])
  })

  it('gives only "All" with a count of 0 when there is no video', () => {
    expect(categoryChips([])).toEqual([{ id: ALL, name: 'All', color: null, count: 0 }])
  })
})

describe('visibleVideos', () => {
  it('filters by category and by query together', () => {
    const rows = [
      listed('a', YOGA, { title: 'Morning flow' }),
      listed('b', YOGA, { title: 'Hip opener' }),
      listed('c', ARMS, { title: 'Morning curls' }),
      listed('d', null, { title: 'Morning walk' }),
    ]

    expect(
      visibleVideos(rows, { categoryId: YOGA.id, query: 'morning' }).map((row) => row.id),
    ).toEqual(['a'])
    expect(visibleVideos(rows, { categoryId: ALL, query: 'morning' }).map((row) => row.id)).toEqual(
      ['a', 'c', 'd'],
    )
    expect(visibleVideos(rows, { categoryId: ARMS.id, query: '' }).map((row) => row.id)).toEqual([
      'c',
    ])
  })
})
