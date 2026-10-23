import { ProfileAvatarLink } from '../profile/ProfileAvatarLink'

import type { ReactNode } from 'react'

export type SavedHeaderProps = {
  count: number
  categories: number
  onSave: () => void
  children?: ReactNode
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

export function savedSummary(count: number, categories: number): string {
  return `${plural(count, 'video', 'videos')} · ${plural(categories, 'category', 'categories')}`
}

export function SaveButton({ onSave }: { onSave: () => void }) {
  return (
    <button
      type="button"
      onClick={onSave}
      className="bg-accent text-accent-ink border-accent inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-full border px-4 text-sm font-extrabold whitespace-nowrap"
    >
      <span aria-hidden="true">+</span> Save <span className="sr-only">a video</span>
    </button>
  )
}

export function SavedHeader({ count, categories, onSave, children }: SavedHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[23px] leading-tight font-bold tracking-[-0.6px]">Saved</h1>
        <p className="text-muted mt-0.5 text-[13px] font-semibold">
          {savedSummary(count, categories)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SaveButton onSave={onSave} />
        {children}
        <ProfileAvatarLink />
      </div>
    </header>
  )
}
