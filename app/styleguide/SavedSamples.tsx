'use client'

import { useState } from 'react'

import { SavedList } from '../../components/saved/SavedVideos'
import { SaveVideoSheet } from '../../components/saved/SaveVideoSheet'
import { MicroLabel } from '../../components/ui/MicroLabel'
import { SecondaryButton } from '../../components/ui/SecondaryButton'

import type { SaveVideo } from '../../components/saved/SaveVideoSheet'
import type { VideoCategory } from '../../lib/db/dexie'
import type { ListedVideo } from '../../lib/db/repository'
import type { Priority } from '../../lib/schema/savedVideo'

const SAMPLE_AT = '2026-10-20T09:00:00.000Z'

function category(id: string, name: string, color: VideoCategory['color']): VideoCategory {
  return { id, name, color, created_at: SAMPLE_AT, updated_at: SAMPLE_AT, deleted_at: null }
}

const GYM = category('sample-gym', 'Gym tricks', 'data-violet')
const HOME = category('sample-home', 'Home', 'data-blue')
const MEDITATION = category('sample-meditation', 'Meditation', 'data-pink')
const STRETCHING = category('sample-stretching', 'Stretching', 'data-cyan')

export const SAMPLE_CATEGORIES: readonly VideoCategory[] = [GYM, HOME, MEDITATION, STRETCHING]

function video(
  index: number,
  title: string,
  of: VideoCategory,
  priority: Priority,
  tags: string[],
): ListedVideo {
  return {
    id: `sample-video-${String(index)}`,
    url: `https://www.instagram.com/reel/sample${String(index)}`,
    title,
    category_id: of.id,
    category: of,
    tags,
    priority,
    created_at: SAMPLE_AT,
    updated_at: SAMPLE_AT,
    deleted_at: null,
  }
}

const FIRST = video(1, 'Bench press: easy form fix', GYM, 'high', ['chest', 'gym'])

export const SAMPLE_VIDEOS: readonly ListedVideo[] = [
  FIRST,
  video(2, '5 min box breathing', MEDITATION, 'normal', ['evening']),
  video(3, 'Grip trick for pull ups', GYM, 'normal', ['back']),
  video(4, '20 min home workout, no gear', HOME, 'normal', ['fullbody']),
  video(5, 'Hip opener before legs', STRETCHING, 'low', ['legs']),
  video(6, 'Rest time between sets', GYM, 'low', ['gym']),
  video(7, 'Shoulder mobility warm up', STRETCHING, 'low', ['shoulders']),
]

export const SAMPLE_TAGS: readonly string[] = ['stretch', 'evening', 'legs']

const sampleSave: SaveVideo = () => Promise.resolve(FIRST)

function ignore(): void {
  return undefined
}

export function SavedListSample() {
  return (
    <div className="flex flex-col gap-8">
      <div data-testid="saved-list-sample">
        <SavedList
          videos={SAMPLE_VIDEOS}
          standalone={false}
          onSave={ignore}
          onEdit={ignore}
          onDelete={ignore}
        />
      </div>
      <div data-testid="saved-empty-sample" className="flex flex-col gap-3">
        <MicroLabel as="p">Empty state</MicroLabel>
        <SavedList
          videos={[]}
          standalone={false}
          onSave={ignore}
          onEdit={ignore}
          onDelete={ignore}
        />
      </div>
    </div>
  )
}

export function SaveFormSample() {
  const [editing, setEditing] = useState<ListedVideo | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <div data-testid="save-form-sample" className="flex max-w-sm flex-col gap-3">
      <SecondaryButton
        onClick={() => {
          setEditing(null)
          setOpen(true)
        }}
      >
        Open the save form
      </SecondaryButton>
      <SecondaryButton
        onClick={() => {
          setEditing(FIRST)
          setOpen(true)
        }}
      >
        Open the edit form
      </SecondaryButton>
      <SaveVideoSheet
        open={open}
        video={editing}
        categories={SAMPLE_CATEGORIES}
        tags={SAMPLE_TAGS}
        save={sampleSave}
        onClose={() => {
          setOpen(false)
        }}
      />
    </div>
  )
}
