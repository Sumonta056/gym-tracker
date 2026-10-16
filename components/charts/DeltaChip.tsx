import { cn } from '../ui/cn'

import type { Direction } from '../../lib/metrics/dayCompare'

export type DeltaChipProps = {
  direction: Direction
  text: string
}

const ARROW: Record<Direction, string> = { up: '▲', down: '▼', same: '=' }

const ARROW_CLASS: Record<Direction, string> = {
  up: 'text-ok',
  down: 'text-warn',
  same: 'text-muted',
}

const SPOKEN: Record<Direction, string> = { up: 'Up ', down: 'Down ', same: '' }

export function DeltaChip({ direction, text }: DeltaChipProps) {
  return (
    <p
      data-direction={direction}
      className="bg-surface-2 text-text inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
    >
      <span aria-hidden="true" className={cn(ARROW_CLASS[direction])}>
        {ARROW[direction]}
      </span>
      <span>
        {SPOKEN[direction] === '' ? null : <span className="sr-only">{SPOKEN[direction]}</span>}
        {text}
      </span>
    </p>
  )
}
