'use client'

import { useEffect, useRef, useState } from 'react'

export const UNDO_MS = 5000

export type Toast = { key: string; message: string }

export type UndoToastProps = {
  toast: Toast | null
  onUndo: () => void
  onDismiss: () => void
  durationMs?: number
}

function focusIsLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body
}

export function UndoToast({ toast, onUndo, onDismiss, durationMs = UNDO_MS }: UndoToastProps) {
  const dismiss = useRef(onDismiss)
  const undoButton = useRef<HTMLButtonElement>(null)
  const movedHere = useRef(false)
  const [held, setHeld] = useState({ focus: false, pointer: false })
  const key = toast?.key ?? null
  const paused = held.focus || held.pointer

  useEffect(() => {
    dismiss.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (key !== null && focusIsLost() && undoButton.current !== null) {
      movedHere.current = true
      undoButton.current.focus()
    }
  }, [key])

  useEffect(() => {
    if (key === null || paused) {
      return
    }

    const timer = setTimeout(() => {
      dismiss.current()
    }, durationMs)

    return () => {
      clearTimeout(timer)
    }
  }, [key, durationMs, paused])

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 flex justify-center px-5 md:px-7 lg:bottom-6 lg:left-60"
    >
      {toast === null ? null : (
        <div
          data-testid="undo-toast"
          className="bg-surface-2 border-border rounded-card pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 border py-1.5 pr-1.5 pl-4"
        >
          <p className="text-text min-w-0 text-sm font-semibold break-words">{toast.message}</p>
          <button
            ref={undoButton}
            type="button"
            onFocus={() => {
              if (movedHere.current) {
                movedHere.current = false
                return
              }

              setHeld((now) => ({ ...now, focus: true }))
            }}
            onBlur={() => {
              setHeld((now) => ({ ...now, focus: false }))
            }}
            onPointerEnter={() => {
              setHeld((now) => ({ ...now, pointer: true }))
            }}
            onPointerLeave={() => {
              setHeld((now) => ({ ...now, pointer: false }))
            }}
            onClick={onUndo}
            className="text-accent inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

export function ToastRoom({ shown }: { shown: boolean }) {
  return shown ? <div aria-hidden="true" data-testid="toast-room" className="h-20" /> : null
}
