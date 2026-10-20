import Link from 'next/link'

import { HeroCard } from '../ui/HeroCard'

import { planPath, reasonText, stepsLinkText } from './planText'

import type { Plan } from '../../lib/schema/plan'

export const SUGGESTION_LABEL = "Today's suggestion"

export type SuggestedPlanHeroProps = {
  plan: Plan
  lastDone: string | undefined
  today: string
  className?: string
}

export function SuggestedPlanHero({ plan, lastDone, today, className }: SuggestedPlanHeroProps) {
  return (
    <HeroCard label={SUGGESTION_LABEL} aria-label={SUGGESTION_LABEL} className={className}>
      <p className="mt-2 text-[26px] leading-[1.1] font-extrabold tracking-[-0.8px]">
        {plan.title}
      </p>
      <p className="mt-1 text-[13px] font-semibold opacity-80">{reasonText(lastDone, today)}</p>
      <Link
        href={planPath(plan.id)}
        className="focus-visible:outline-accent-ink inline-flex min-h-11 items-center text-sm font-extrabold"
      >
        {stepsLinkText(plan)}
      </Link>
    </HeroCard>
  )
}
