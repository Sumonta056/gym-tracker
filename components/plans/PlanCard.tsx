import { planMuscles, planSteps } from '../../lib/plans'
import { cn } from '../ui/cn'

import { MuscleMap } from './MuscleMap'
import { cardLine } from './planText'

import type { Plan } from '../../lib/schema/plan'

export type PlanThumbProps = {
  src: string | undefined
  ground?: 'surface' | 'surface-2'
  className?: string
}

export function PlanThumb({ src, ground = 'surface-2', className }: PlanThumbProps) {
  return (
    <span
      className={cn(
        'block h-10 w-[60px] shrink-0 overflow-hidden rounded-[10px]',
        ground === 'surface' ? 'bg-surface' : 'bg-surface-2',
        className,
      )}
    >
      {src === undefined ? null : (
        <picture>
          <img
            src={src}
            alt=""
            width={60}
            height={40}
            loading="lazy"
            decoding="async"
            className="block size-full object-cover"
          />
        </picture>
      )}
    </span>
  )
}

export type PlanCardProps = {
  plan: Plan
  lastDone: string | undefined
  today: string
  selected: boolean
  onToggle: () => void
  className?: string
}

export function PlanCard({ plan, lastDone, today, selected, onToggle, className }: PlanCardProps) {
  const { primary, secondary } = planMuscles(plan)

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'rounded-card bg-surface text-text flex min-h-[72px] w-full items-center gap-3 border p-3 text-left',
        selected ? 'border-accent' : 'border-border',
        className,
      )}
    >
      <PlanThumb src={planSteps(plan)[0]?.images.start} />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <strong className="text-[15px] font-bold">{plan.title}</strong>
        <span className="text-muted text-xs">{cardLine(plan, lastDone, today)}</span>
      </span>
      <MuscleMap primary={primary} secondary={secondary} size="chip" />
      <span
        aria-hidden="true"
        data-testid="plan-mark"
        className={cn(
          'text-accent-ink grid size-[26px] shrink-0 place-items-center rounded-full border-2 text-sm font-extrabold',
          selected ? 'bg-accent border-accent' : 'border-border',
        )}
      >
        {selected ? '✓' : null}
      </span>
    </button>
  )
}
