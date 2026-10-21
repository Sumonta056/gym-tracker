'use client'

import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { SheetModal } from '../ui/SheetModal'

import { targetText } from './planText'

import type { StepStatus } from '../../lib/metrics/planProgress'
import type { PlanStep } from '../../lib/schema/plan'
import type { ReactNode } from 'react'

export const STEP_LIST_CLOSE = 'Close the step list'

export const STEP_MARK: Record<StepStatus, { glyph: string; word: string }> = {
  done: { glyph: '✓', word: 'Done' },
  now: { glyph: '●', word: 'Now' },
  skipped: { glyph: '–', word: 'Skipped' },
  todo: { glyph: '○', word: 'Not started' },
}

const MARK_CLASS: Record<StepStatus, string> = {
  done: 'border-accent bg-accent text-accent-ink',
  now: 'border-accent',
  skipped: 'border-dim border-dashed',
  todo: 'border-border',
}

export type StepMarkProps = {
  status: StepStatus
  label?: ReactNode
  tone?: 'muted' | 'text'
}

export function StepMark({ status, label, tone = 'muted' }: StepMarkProps) {
  const mark = STEP_MARK[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap',
        status === 'now' ? 'text-accent' : tone === 'text' ? 'text-text' : 'text-muted',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'font-glyph inline-flex size-5 items-center justify-center rounded-full border text-[11px]',
          MARK_CLASS[status],
        )}
      >
        {mark.glyph}
      </span>
      {label ?? mark.word}
    </span>
  )
}

export function stepRowLabel(index: number, step: PlanStep, status: StepStatus): string {
  return `${String(index + 1)}. ${step.name}, ${targetText(step.target)}, ${STEP_MARK[status].word}`
}

export function stepListSummary(statuses: readonly StepStatus[]): string {
  const count = (wanted: StepStatus[]) =>
    statuses.filter((status) => wanted.includes(status)).length

  return `${String(count(['done']))} done · ${String(count(['skipped']))} skipped · ${String(count(['now', 'todo']))} to go`
}

export type StepSection = { name: string; items: { step: PlanStep; index: number }[] }

export function stepSections(
  steps: readonly PlanStep[],
  groups: ReadonlyMap<string, string>,
): StepSection[] {
  const sections: StepSection[] = []

  steps.forEach((step, index) => {
    const name = groups.get(step.exerciseId) ?? ''
    const last = sections.at(-1)

    if (last?.name === name) last.items.push({ step, index })
    else sections.push({ name, items: [{ step, index }] })
  })

  return sections
}

export type StepListSheetProps = {
  open: boolean
  title: string
  steps: readonly PlanStep[]
  groups: ReadonlyMap<string, string>
  statuses: readonly StepStatus[]
  onPick: (index: number) => void
  onClose: () => void
}

export function StepListSheet({
  open,
  title,
  steps,
  groups,
  statuses,
  onPick,
  onClose,
}: StepListSheetProps) {
  return (
    <SheetModal
      open={open}
      title={title}
      closeLabel={STEP_LIST_CLOSE}
      onClose={onClose}
      subtitle={stepListSummary(statuses)}
      className="max-h-[92%]"
    >
      <div className="grid gap-3.5">
        {stepSections(steps, groups).map((section, sectionIndex) => (
          <section key={`${String(sectionIndex)}-${section.name}`} aria-label={section.name}>
            <h3 className="mb-1">
              <MicroLabel>{section.name}</MicroLabel>
            </h3>
            <ol className="grid gap-1">
              {section.items.map(({ step, index }) => {
                const status = statuses[index] ?? 'todo'

                return (
                  <li key={step.slug}>
                    <button
                      type="button"
                      data-state={status}
                      aria-current={status === 'now' ? 'step' : undefined}
                      aria-label={stepRowLabel(index, step, status)}
                      onClick={() => {
                        onPick(index)
                      }}
                      className={cn(
                        'bg-surface-2 text-text grid min-h-[52px] w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] border px-3 text-left',
                        status === 'now' ? 'border-accent' : 'border-border',
                      )}
                    >
                      <span className="text-muted text-xs font-bold">{index + 1}</span>
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
      </div>
    </SheetModal>
  )
}
