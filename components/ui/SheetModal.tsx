'use client'

import { useEffect, useId, useLayoutEffect, useRef } from 'react'

import { cn } from './cn'

import type { ReactNode } from 'react'

export type SheetModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
}

function trapTab(event: KeyboardEvent, dialog: HTMLElement): void {
  const items = focusables(dialog)
  const first = items[0]
  const last = items.at(-1)
  if (first === undefined || last === undefined) {
    event.preventDefault()
    return
  }

  event.preventDefault()
  const at = items.findIndex((item) => item === document.activeElement)

  if (at === -1) {
    ;(event.shiftKey ? last : first).focus()
    return
  }

  const step = event.shiftKey ? -1 : 1
  const next = items[(at + step + items.length) % items.length] ?? first
  next.focus()
}

export function SheetModal({ open, title, onClose, children, className }: SheetModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    if (dialog !== null) {
      ;(focusables(dialog)[0] ?? dialog).focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (event.key === 'Tab' && dialog !== null) {
        trapTab(event, dialog)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = overflow
      opener?.focus()
    }
  }, [open])

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'bg-surface border-border rounded-t-hero relative max-h-[78%] w-full overflow-y-auto border-t px-5 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+20px)]',
          'lg:rounded-hero lg:max-h-[80vh] lg:w-[520px] lg:border lg:pt-5 lg:pb-5',
          className,
        )}
      >
        <div
          data-testid="sheet-grabber"
          aria-hidden="true"
          className="bg-border mx-auto mt-1 mb-3 h-1 w-10 rounded-full lg:hidden"
        />
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-text text-lg font-extrabold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="text-muted bg-surface-2 border-border inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
