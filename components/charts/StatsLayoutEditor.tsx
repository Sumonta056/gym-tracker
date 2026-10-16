'use client'

import { useId, useLayoutEffect, useRef } from 'react'

import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'

import { moveCard, setHidden, STATS_CARDS } from './statsCards'

import type { StatsCardId, StatsLayoutItem } from './statsCards'
import type { Ref } from 'react'

export type StatsLayoutEditorProps = {
  layout: readonly StatsLayoutItem[]
  onChange: (layout: StatsLayoutItem[]) => void
  headingRef?: Ref<HTMLHeadingElement>
}

type Move = { id: StatsCardId; by: -1 | 1 }

const MOVE_CLASS =
  'text-muted bg-surface-2 border-border inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg disabled:opacity-50'

function direction(by: -1 | 1): 'up' | 'down' {
  return by === -1 ? 'up' : 'down'
}

export function StatsLayoutEditor({ layout, onChange, headingRef }: StatsLayoutEditorProps) {
  const prefix = useId()
  const moved = useRef<Move | null>(null)

  useLayoutEffect(() => {
    const last = moved.current

    if (last === null) {
      return
    }

    moved.current = null

    const pressed = document.getElementById(`${prefix}-${last.id}-${direction(last.by)}`)
    const other = document.getElementById(
      `${prefix}-${last.id}-${direction(last.by === -1 ? 1 : -1)}`,
    )
    const target = pressed instanceof HTMLButtonElement && pressed.disabled ? other : pressed

    target?.focus()
  }, [layout, prefix])

  function move(id: StatsCardId, by: -1 | 1) {
    moved.current = { id, by }
    onChange(moveCard(layout, id, by))
  }

  return (
    <Card className="mt-4">
      <h2 ref={headingRef} tabIndex={-1}>
        <MicroLabel>Stats cards</MicroLabel>
      </h2>
      <ol aria-label="Stats cards" className="mt-2 flex flex-col gap-1">
        {layout.map((item, index) => {
          const name = STATS_CARDS[item.id].name

          return (
            <li key={item.id} data-card-id={item.id} className="flex min-h-11 items-center gap-2">
              <span className="min-w-0 flex-1">
                <span
                  className={cn('text-[15px] font-bold', item.hidden ? 'text-muted' : 'text-text')}
                >
                  {name}
                </span>
                {item.hidden ? <span className="text-muted text-xs"> · Hidden</span> : null}
              </span>
              <button
                type="button"
                id={`${prefix}-${item.id}-up`}
                aria-label={`Move ${name} up`}
                disabled={index === 0}
                onClick={() => {
                  move(item.id, -1)
                }}
                className={MOVE_CLASS}
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                id={`${prefix}-${item.id}-down`}
                aria-label={`Move ${name} down`}
                disabled={index === layout.length - 1}
                onClick={() => {
                  move(item.id, 1)
                }}
                className={MOVE_CLASS}
              >
                <span aria-hidden="true">↓</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={!item.hidden}
                aria-label={`Show ${name}`}
                onClick={() => {
                  onChange(setHidden(layout, item.id, !item.hidden))
                }}
                className="inline-flex h-11 w-14 shrink-0 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'border-border relative inline-flex h-7 w-12 items-center rounded-full border',
                    item.hidden ? 'bg-surface-2' : 'bg-accent',
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-1 size-5 rounded-full motion-safe:transition-transform motion-safe:duration-150',
                      item.hidden ? 'bg-dim translate-x-0' : 'bg-accent-ink translate-x-5',
                    )}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
