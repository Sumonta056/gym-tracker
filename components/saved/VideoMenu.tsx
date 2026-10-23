'use client'

import { useEffect, useId, useRef, useState } from 'react'

const ITEM_CLASS =
  'flex min-h-11 w-full items-center rounded-input px-4 text-left text-sm font-bold'

export type VideoMenuProps = {
  title: string
  onEdit: () => void
  onDelete: () => void
}

export function VideoMenu({ title, onEdit, onDelete }: VideoMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    firstRef.current?.focus()

    function onPointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target) !== true) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={toggleRef}
        type="button"
        aria-label={`More for ${title}`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((now) => !now)
        }}
        className="text-muted mr-1.5 inline-flex size-11 items-center justify-center rounded-[14px] text-lg"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="group"
          aria-label={`Actions for ${title}`}
          className="bg-surface-2 border-border rounded-card absolute top-full right-1.5 z-30 mt-1 flex w-40 flex-col gap-1 border p-1.5"
        >
          <button
            ref={firstRef}
            type="button"
            onClick={() => {
              choose(onEdit)
            }}
            className={`${ITEM_CLASS} text-text`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              choose(onDelete)
            }}
            className={`${ITEM_CLASS} text-danger`}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}
