import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PlanStartBar } from '../../../../components/plans/PlanStartBar'
import { PlanStepList } from '../../../../components/plans/PlanStepList'
import { previewLine, START_BAR_CLASS } from '../../../../components/plans/planText'
import { WORKOUTS_PATH } from '../../../../components/workouts/historyText'
import { findPlan, listPlans } from '../../../../lib/plans'

import type { Metadata } from 'next'

type PlanPreviewProps = { params: Promise<{ planId: string }> }

export const dynamicParams = false

export function generateStaticParams(): { planId: string }[] {
  return listPlans().map((plan) => ({ planId: plan.id }))
}

export async function generateMetadata({ params }: PlanPreviewProps): Promise<Metadata> {
  const plan = findPlan((await params).planId)

  return { title: plan === undefined ? 'Gym Tracker' : `${plan.title} — Gym Tracker` }
}

export default async function PlanPreviewPage({ params }: PlanPreviewProps) {
  const plan = findPlan((await params).planId)

  if (plan === undefined) {
    notFound()
  }

  return (
    <>
      <Link
        href={WORKOUTS_PATH}
        className="text-muted inline-flex min-h-11 items-center text-sm font-semibold"
      >
        <span aria-hidden="true">‹&nbsp;</span>Plans
      </Link>
      <h1 className="text-[23px] leading-tight font-bold tracking-[-0.6px]">{plan.title}</h1>
      <p className="text-muted mt-1 text-[13px]">{previewLine(plan)}</p>
      <div className="mt-4">
        <PlanStepList plan={plan} />
      </div>
      <div className={`${START_BAR_CLASS} lg:mt-4`}>
        <PlanStartBar plans={[plan]} showDetail={false} />
      </div>
      <div aria-hidden="true" className="h-24 lg:hidden" />
    </>
  )
}
