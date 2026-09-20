'use client'

import { useEffect, useId } from 'react'

import { cn } from './cn'

import type { ReactNode } from 'react'

export type SheetModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export function SheetModal({ open, title, onClose, children, className }: SheetModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="bg-ground/70 absolute inset-0 h-full w-full"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'bg-surface border-border relative max-h-[85dvh] w-full overflow-y-auto rounded-t-[24px] border px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]',
          'lg:rounded-hero lg:max-w-[480px] lg:pb-5',
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-text text-lg font-extrabold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="text-muted bg-surface-2 border-border inline-flex h-11 w-11 items-center justify-center rounded-full border text-lg"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
