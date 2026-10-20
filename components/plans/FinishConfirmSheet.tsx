'use client'

import { useId, useRef } from 'react'

import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SheetModal } from '../ui/SheetModal'

import { STEP_MARK } from './StepListSheet'

import type { StepStatus } from '../../lib/metrics/planProgress'

export const FINISH_TITLE = 'Finish the session?'

export const FINISH_ANYWAY = 'Finish anyway'

export const KEEP_GOING = 'Keep going'

export const LISTED_TEXT = 'The summary lists them as not done.'

export type NotDoneStep = { index: number; name: string; status: StepStatus }

function counted(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`
}

function markOf(step: NotDoneStep) {
  return STEP_MARK[step.status === 'skipped' ? 'skipped' : 'todo']
}

export function notDoneText(count: number): string {
  return `${counted(count, 'step')} not done.`
}

export function keptText(setCount: number): string {
  return setCount === 0
    ? 'No set is ticked yet.'
    : `The ${counted(setCount, 'set')} you ticked ${setCount === 1 ? 'is' : 'are'} kept.`
}

export type FinishConfirmSheetProps = {
  open: boolean
  notDone: readonly NotDoneStep[]
  setCount: number
  busy?: boolean
  onFinish: () => void
  onClose: () => void
}

export function FinishConfirmSheet({
  open,
  notDone,
  setCount,
  busy = false,
  onFinish,
  onClose,
}: FinishConfirmSheetProps) {
  const bodyId = useId()
  const keep = useRef<HTMLButtonElement>(null)

  return (
    <SheetModal
      open={open}
      title={FINISH_TITLE}
      onClose={onClose}
      describedBy={bodyId}
      initialFocus={keep}
    >
      <div className="flex flex-col gap-3">
        <p id={bodyId} className="text-[15px] leading-[1.45]">
          <strong>{notDoneText(notDone.length)}</strong>{' '}
          <span className="text-muted text-sm">{`${LISTED_TEXT} ${keptText(setCount)}`}</span>
        </p>
        <ul aria-label="Steps not done" className="bg-surface-2 rounded-input px-3.5 py-1">
          {notDone.map((step) => (
            <li
              key={step.index}
              className="border-border flex min-h-9 items-center justify-between gap-3 border-b last:border-b-0"
            >
              <span className="min-w-0 text-sm break-words">{`${String(step.index + 1)} · ${step.name}`}</span>
              <span className="text-muted text-[13px] whitespace-nowrap">
                <span aria-hidden="true">{`${markOf(step).glyph} `}</span>
                {markOf(step).word}
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2.5">
          <PrimaryButton disabled={busy} onClick={onFinish}>
            {FINISH_ANYWAY}
          </PrimaryButton>
          <SecondaryButton ref={keep} onClick={onClose}>
            {KEEP_GOING}
          </SecondaryButton>
        </div>
      </div>
    </SheetModal>
  )
}
