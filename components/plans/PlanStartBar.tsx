'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
  getActiveSession,
  SessionAlreadyActive,
  setPlanCursor,
  SignedOutOnThisDevice,
  startPlanSession,
} from '../../lib/db/repository'
import { localDate } from '../../lib/schema/dailyEntry'
import { cn } from '../ui/cn'
import { PrimaryButton } from '../ui/PrimaryButton'
import { ResumePrompt, WORKOUT_PATH } from '../workout/ResumePrompt'

import { startDetail, startLabel } from './planText'

import type { PlanCursor, WorkoutSession } from '../../lib/db/dexie'
import type { Plan, PlanId } from '../../lib/schema/plan'

export const PLAN_START_FAILED = 'The plan could not be started on this device.'

export type PlanStartSource = {
  getActiveSession: () => Promise<WorkoutSession | undefined>
  startPlanSession: (planIds: PlanId[], date: string) => Promise<WorkoutSession>
  setPlanCursor: (cursor: PlanCursor) => Promise<void>
}

export const REPOSITORY_PLAN_START: PlanStartSource = {
  getActiveSession,
  startPlanSession,
  setPlanCursor,
}

export type PlanStartBarProps = {
  plans: readonly Plan[]
  showDetail?: boolean
  source?: PlanStartSource
  today?: () => string
  className?: string
}

export function PlanStartBar({
  plans,
  showDetail = true,
  source = REPOSITORY_PLAN_START,
  today = localDate,
  className,
}: PlanStartBarProps) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prompts, setPrompts] = useState(0)
  const detail = showDetail ? startDetail(plans) : null

  const showPrompt = () => {
    setStarting(false)
    setPrompts((count) => count + 1)
  }

  const start = async () => {
    const active = await source.getActiveSession()

    if (active !== undefined) {
      showPrompt()
      return
    }

    const session = await source.startPlanSession(
      plans.map((plan) => plan.id),
      today(),
    )
    await source.setPlanCursor({ sessionId: session.id, stepIndex: 0, skipped: [] })
    router.push(WORKOUT_PATH)
  }

  const onStart = () => {
    if (starting || plans.length === 0) return

    setStarting(true)
    setError(null)
    start().catch((cause: unknown) => {
      if (cause instanceof SessionAlreadyActive) {
        showPrompt()
        return
      }

      setStarting(false)
      setError(cause instanceof SignedOutOnThisDevice ? cause.message : PLAN_START_FAILED)
    })
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <PrimaryButton
        disabled={plans.length === 0 || starting}
        onClick={onStart}
        className="flex-col gap-px py-2"
      >
        {startLabel(plans)}
        {detail === null ? null : (
          <span className="text-[11px] font-medium opacity-80">{detail}</span>
        )}
      </PrimaryButton>
      {error === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      {prompts === 0 ? null : <ResumePrompt key={prompts} />}
    </div>
  )
}
