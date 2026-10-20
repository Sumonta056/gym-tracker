import { useId } from 'react'

import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'

import { PlanThumb } from './PlanCard'
import { targetText } from './planText'
import { stepListSummary, StepMark, stepRowLabel, stepSections } from './StepListSheet'

import type { StepStatus } from '../../lib/metrics/planProgress'
import type { PlanStep } from '../../lib/schema/plan'

export type StepListPanelProps = {
  steps: readonly PlanStep[]
  groups: ReadonlyMap<string, string>
  statuses: readonly StepStatus[]
  busy?: boolean
  onPick: (index: number) => void
  className?: string
}

export function StepListPanel({
  steps,
  groups,
  statuses,
  busy = false,
  onPick,
  className,
}: StepListPanelProps) {
  const headingId = useId()

  return (
    <Card className={cn('grid gap-3.5', className)}>
      <section aria-labelledby={headingId} className="grid gap-3.5">
        <div>
          <h2 id={headingId}>
            <MicroLabel>Steps</MicroLabel>
          </h2>
          <p className="text-muted text-[13px]">{stepListSummary(statuses)}</p>
        </div>
        {stepSections(steps, groups).map((section, sectionIndex) => (
          <section key={`${String(sectionIndex)}-${section.name}`} aria-label={section.name}>
            <h3 className="mb-1.5">
              <MicroLabel>{section.name}</MicroLabel>
            </h3>
            <ol className="grid gap-1.5">
              {section.items.map(({ step, index }) => {
                const status = statuses[index] ?? 'todo'

                return (
                  <li key={step.slug}>
                    <button
                      type="button"
                      data-state={status}
                      aria-current={status === 'now' ? 'step' : undefined}
                      aria-label={stepRowLabel(index, step, status)}
                      disabled={busy}
                      onClick={() => {
                        onPick(index)
                      }}
                      className={cn(
                        'bg-surface-2 text-text grid min-h-[58px] w-full grid-cols-[18px_60px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] border px-3 py-2 text-left',
                        status === 'now' ? 'border-accent' : 'border-border',
                      )}
                    >
                      <span className="text-muted text-xs font-bold">{index + 1}</span>
                      <PlanThumb src={step.images.start} ground="surface" />
                      <span className="grid min-w-0 text-sm font-bold break-words">
                        {step.name}
                        <span className="text-muted text-xs font-semibold">
                          {targetText(step.target)}
                        </span>
                      </span>
                      <StepMark status={status} />
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
      </section>
    </Card>
  )
}
