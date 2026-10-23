import { cn } from '../ui/cn'

import type { CategoryColor } from '../../lib/schema/videoCategory'
import type { CategoryChip } from '../../lib/videos/list'

export const CATEGORY_DOT: Record<CategoryColor, string> = {
  'data-cyan': 'bg-data-cyan',
  'data-violet': 'bg-data-violet',
  'data-pink': 'bg-data-pink',
  'data-blue': 'bg-data-blue',
  'data-yellow': 'bg-data-yellow',
  'data-slate': 'bg-data-slate',
}

export const CHIP_CLASS =
  'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-bold whitespace-nowrap'

export function chipTone(pressed: boolean): string {
  return pressed
    ? 'bg-accent border-accent text-accent-ink'
    : 'bg-surface-2 border-border text-muted'
}

export function CategoryDot({ color }: { color: CategoryColor }) {
  return (
    <span
      data-testid="category-dot"
      aria-hidden="true"
      className={cn('size-2 shrink-0 rounded-full', CATEGORY_DOT[color])}
    />
  )
}

export type CategoryChipsProps = {
  chips: readonly CategoryChip[]
  selected: string
  onSelect: (id: string) => void
}

export function CategoryChips({ chips, selected, onSelect }: CategoryChipsProps) {
  return (
    <div
      role="group"
      aria-label="Category"
      data-testid="category-chips"
      className="-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 md:-mx-7 md:px-7 lg:mx-0 lg:px-0"
    >
      {chips.map((chip) => {
        const pressed = chip.id === selected

        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              onSelect(chip.id)
            }}
            className={cn(CHIP_CLASS, chipTone(pressed))}
          >
            {chip.color === null ? null : <CategoryDot color={chip.color} />}
            {chip.name} <span className="font-semibold">{chip.count}</span>
          </button>
        )
      })}
    </div>
  )
}
