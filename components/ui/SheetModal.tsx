'use client'

import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { cn } from './cn'

import type { ReactNode, RefObject } from 'react'

export type SheetModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
  closeDisabled?: boolean
  describedBy?: string
  closeLabel?: string
  subtitle?: ReactNode
  initialFocus?: RefObject<HTMLElement | null>
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
    ;(event.shiftKey ? last : first).focus({ preventScroll: true })
    return
  }

  const step = event.shiftKey ? -1 : 1
  const next = items[(at + step + items.length) % items.length] ?? first
  next.focus({ preventScroll: true })
}

let lockHolders = 0

let releaseRoot: (() => void) | null = null

function hideRootOverflow(): () => void {
  const { style } = document.documentElement
  const held = style.overflow

  style.overflow = 'hidden'

  return () => {
    style.overflow = held
  }
}

export function lockScroll(): () => void {
  lockHolders += 1

  if (lockHolders === 1) {
    releaseRoot = hideRootOverflow()
  }

  let released = false

  return () => {
    if (released) {
      return
    }

    released = true
    lockHolders -= 1

    if (lockHolders === 0) {
      releaseRoot?.()
      releaseRoot = null
    }
  }
}

function visualViewport(): VisualViewport | null {
  return 'visualViewport' in window ? window.visualViewport : null
}

function subscribeViewport(onChange: () => void): () => void {
  const viewport = visualViewport()

  if (viewport === null) {
    return () => undefined
  }

  viewport.addEventListener('resize', onChange)
  viewport.addEventListener('scroll', onChange)

  return () => {
    viewport.removeEventListener('resize', onChange)
    viewport.removeEventListener('scroll', onChange)
  }
}

function viewportHeight(): number | null {
  return visualViewport()?.height ?? null
}

function viewportTop(): number {
  return visualViewport()?.offsetTop ?? 0
}

function noHeight(): number | null {
  return null
}

function noTop(): number {
  return 0
}

export function SheetModal({
  open,
  title,
  onClose,
  children,
  footer,
  className,
  closeDisabled = false,
  describedBy,
  closeLabel,
  subtitle,
  initialFocus,
}: SheetModalProps) {
  const split = footer !== undefined || subtitle !== undefined
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)
  const initialFocusRef = useRef(initialFocus)
  const height = useSyncExternalStore(subscribeViewport, viewportHeight, noHeight)
  const offsetTop = useSyncExternalStore(subscribeViewport, viewportTop, noTop)

  useEffect(() => {
    onCloseRef.current = onClose
    closeDisabledRef.current = closeDisabled
    initialFocusRef.current = initialFocus
  }, [onClose, closeDisabled, initialFocus])

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const unlock = lockScroll()

    if (dialog !== null) {
      const first = initialFocusRef.current?.current ?? focusables(dialog)[0] ?? dialog
      first.focus({ preventScroll: true })
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!closeDisabledRef.current) onCloseRef.current()
        return
      }

      if (event.key === 'Tab' && dialog !== null) {
        trapTab(event, dialog)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      unlock()
      opener?.focus({ preventScroll: true })
    }
  }, [open])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      data-testid="sheet-overlay"
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      style={height === null ? undefined : { top: offsetTop, height, bottom: 'auto' }}
    >
      <button
        type="button"
        aria-label="Close"
        disabled={closeDisabled}
        onClick={onClose}
        className="bg-ground/70 absolute inset-0 h-full w-full"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn(
          'bg-surface border-border rounded-t-hero relative max-h-[78%] w-full border-t pt-2.5',
          'lg:rounded-hero lg:max-h-[80vh] lg:w-[520px] lg:border lg:pt-5',
          !split
            ? 'overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] lg:pb-5'
            : 'flex flex-col overflow-hidden',
          className,
        )}
      >
        <div className={split ? 'shrink-0 px-5' : undefined}>
          <div
            data-testid="sheet-grabber"
            aria-hidden="true"
            className="bg-border mx-auto mt-1 mb-3 h-1 w-10 rounded-full lg:hidden"
          />
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-text text-lg font-extrabold">
                {title}
              </h2>
              {subtitle === undefined ? null : <p className="text-muted text-[13px]">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label={closeLabel ?? `Close ${title}`}
              className="text-muted bg-surface-2 border-border inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg disabled:opacity-50"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
        {!split ? (
          children
        ) : (
          <>
            <div
              data-testid="sheet-body"
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-1',
                footer === undefined && 'pb-[calc(env(safe-area-inset-bottom)+20px)] lg:pb-5',
              )}
            >
              {children}
            </div>
            {footer === undefined ? null : (
              <div
                data-testid="sheet-footer"
                className="shrink-0 px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+20px)] lg:pb-5"
              >
                {footer}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
