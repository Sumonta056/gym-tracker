'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'

import {
  deleteSavedVideo,
  listSavedVideos,
  listVideoCategories,
  listVideoTags,
  restoreSavedVideo,
  SignedOutOnThisDevice,
} from '../../lib/db/repository'
import { safeQuery } from '../../lib/db/safeQuery'
import { ALL, categoryChips, visibleVideos } from '../../lib/videos/list'
import { FIELD_INPUT_CLASS } from '../ui/Field'
import { ToastRoom, UndoToast } from '../workout/UndoToast'

import { CategoryChips } from './CategoryChips'
import { RenameCategory } from './RenameCategorySheet'
import { SaveButton, SavedHeader } from './SavedHeader'
import { SaveVideoSheet } from './SaveVideoSheet'
import { useStandalone } from './useStandalone'
import { VideoCard } from './VideoCard'

import type { VideoCategory } from '../../lib/db/dexie'
import type { ListedVideo } from '../../lib/db/repository'
import type { Toast } from '../workout/UndoToast'

export const NO_VIDEOS = 'No videos yet.'

export const NO_MATCH = 'Nothing matches.'

export const READ_FAILED = 'Your saved videos could not be read on this device.'

export const DELETE_FAILED = 'The video could not be deleted on this device. Try again.'

export const RESTORE_FAILED = 'The video could not be restored on this device. Try again.'

export const VIDEO_REMOVED = 'Video deleted.'

export type SavedListProps = {
  videos: readonly ListedVideo[]
  standalone: boolean
  onSave: () => void
  onEdit: (video: ListedVideo) => void
  onDelete: (video: ListedVideo) => void
}

function selectedCategory(videos: readonly ListedVideo[], id: string): VideoCategory | null {
  return videos.find((video) => video.category?.id === id)?.category ?? null
}

export function SavedList({ videos, standalone, onSave, onEdit, onDelete }: SavedListProps) {
  const searchId = useId()
  const [picked, setPicked] = useState(ALL)
  const [query, setQuery] = useState('')
  const listed = [...videos]
  const chips = categoryChips(listed)

  if (picked !== ALL && !chips.some((chip) => chip.id === picked)) {
    setPicked(ALL)
  }

  const selected = chips.some((chip) => chip.id === picked) ? picked : ALL
  const shown = visibleVideos(listed, { categoryId: selected, query })

  return (
    <>
      <SavedHeader count={videos.length} categories={chips.length - 1} onSave={onSave} />
      <div className="mt-4 flex flex-col gap-3">
        <div className="lg:max-w-[420px]">
          <label htmlFor={searchId} className="sr-only">
            Search titles and tags
          </label>
          <input
            id={searchId}
            type="search"
            autoComplete="off"
            placeholder="Search titles and tags"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            className={`${FIELD_INPUT_CLASS} border-border`}
          />
        </div>
        {videos.length === 0 ? null : (
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <CategoryChips chips={chips} selected={selected} onSelect={setPicked} />
            </div>
            <RenameCategory
              category={selected === ALL ? null : selectedCategory(videos, selected)}
            />
          </div>
        )}
        {videos.length === 0 ? (
          <div className="bg-surface border-border rounded-card flex flex-col items-start gap-3 border p-4">
            <p className="text-muted text-sm font-semibold">{NO_VIDEOS}</p>
            <SaveButton onSave={onSave} />
          </div>
        ) : shown.length === 0 ? (
          <p className="text-muted py-6 text-center text-sm font-semibold">{NO_MATCH}</p>
        ) : (
          <ul
            aria-label="Saved videos"
            className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
          >
            {shown.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                standalone={standalone}
                onEdit={() => {
                  onEdit(video)
                }}
                onDelete={() => {
                  onDelete(video)
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

type SavedData = { videos: ListedVideo[]; categories: VideoCategory[]; tags: string[] }

async function readSaved(): Promise<SavedData> {
  const [videos, categories, tags] = await Promise.all([
    listSavedVideos(),
    listVideoCategories(),
    listVideoTags(),
  ])

  return { videos, categories, tags }
}

type Sheet = { open: false } | { open: true; video: ListedVideo | null }

export function SavedVideos() {
  const data = useLiveQuery(safeQuery(readSaved, 'saved'), [])
  const standalone = useStandalone()
  const [sheet, setSheet] = useState<Sheet>({ open: false })
  const [toast, setToast] = useState<(Toast & { videoId: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  const remove = (video: ListedVideo) => {
    setError(null)
    deleteSavedVideo(video.id).then(
      () => {
        setToast({
          key: `${video.id}-${String(Date.now())}`,
          message: VIDEO_REMOVED,
          videoId: video.id,
        })
      },
      (cause: unknown) => {
        setError(cause instanceof SignedOutOnThisDevice ? cause.message : DELETE_FAILED)
      },
    )
  }

  const undo = () => {
    if (toast === null) {
      return
    }

    const { videoId } = toast
    setToast(null)
    restoreSavedVideo(videoId).catch((cause: unknown) => {
      setError(cause instanceof SignedOutOnThisDevice ? cause.message : RESTORE_FAILED)
    })
  }

  const openAdd = () => {
    setSheet({ open: true, video: null })
  }

  return (
    <>
      {data === undefined || data === null ? (
        <SavedHeader count={0} categories={0} onSave={openAdd} />
      ) : (
        <SavedList
          videos={data.videos}
          standalone={standalone}
          onSave={openAdd}
          onEdit={(video) => {
            setSheet({ open: true, video })
          }}
          onDelete={remove}
        />
      )}
      {data === null ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {READ_FAILED}
        </p>
      ) : null}
      {error === null ? null : (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      )}
      <SaveVideoSheet
        open={sheet.open}
        video={sheet.open ? sheet.video : null}
        categories={data?.categories ?? []}
        tags={data?.tags ?? []}
        onClose={() => {
          setSheet({ open: false })
        }}
      />
      <ToastRoom shown={toast !== null} />
      <UndoToast
        toast={toast}
        onUndo={undo}
        onDismiss={() => {
          setToast(null)
        }}
      />
      <div aria-hidden="true" className="h-24 lg:hidden" />
    </>
  )
}
