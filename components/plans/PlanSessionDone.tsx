import Link from 'next/link'
import { useId } from 'react'

import { formatDuration } from '../../lib/duration'
import { formatLoadShort, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { formatCount } from '../dashboard/summary'
import { Card } from '../ui/Card'
import { HeroCard } from '../ui/HeroCard'
import { MicroLabel } from '../ui/MicroLabel'
import { NewRecordsCard, SUMMARY_TITLE } from '../workout/SessionSummary'
import { WORKOUTS_PATH } from '../workouts/historyText'

import { STEP_MARK, StepMark } from './StepListSheet'

import type {
  PlanSessionSummary,
  StepOutcome,
  StepResult,
  StepStatus,
} from '../../lib/metrics/planProgress'
import type { SessionRecord } from '../../lib/metrics/sessionStats'
import type { UnitSystem } from '../../lib/schema/profile'

export const BACK_TO_WORKOUTS = 'Back to Workouts'

const MARK_STATUS: Record<StepOutcome, StepStatus> = {
  done: 'done',
  skipped: 'skipped',
  notDone: 'todo',
}

const NOT_DONE = 'Not done'

function counted(count: number, word: string): string {
  return `${formatCount(count)} ${word}${count === 1 ? '' : 's'}`
}

export function doneFootText(
  summary: PlanSessionSummary,
  stepCount: number,
  unit: UnitSystem,
): string {
  const volume = formatCount(Math.round(toDisplayWeight(summary.volumeKg, unit)))

  return `Volume ${volume} ${weightSymbol(unit)} · ${counted(summary.setCount, 'set')} · ${String(summary.doneSteps)} of ${String(stepCount)} steps`
}

export function stepResultText(result: StepResult, unit: UnitSystem): string {
  if (result.outcome === 'notDone') return NOT_DONE
  if (result.outcome === 'skipped') return STEP_MARK.skipped.word

  const load =
    result.heaviestKg === null
      ? 'Body'
      : `${formatLoadShort(result.heaviestKg, unit)} ${weightSymbol(unit)}`

  return `${String(result.setCount)} × ${load}`
}

export type PlanSessionDoneProps = {
  title: string
  durationSeconds: number
  summary: PlanSessionSummary
  results: readonly StepResult[]
  records: readonly SessionRecord[]
  unit: UnitSystem
  nameOf: (exerciseId: string) => string
}

export function PlanSessionDone({
  title,
  durationSeconds,
  summary,
  results,
  records,
  unit,
  nameOf,
}: PlanSessionDoneProps) {
  const headingId = useId()
  const stepsId = useId()

  return (
    <section aria-labelledby={headingId} className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <div className="mb-1">
        <h1
          id={headingId}
          className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]"
        >
          {SUMMARY_TITLE}
        </h1>
        <p className="text-muted mt-[3px] text-[13px] break-words">{title}</p>
      </div>

      <HeroCard label="Gym time" aria-label="Gym time">
        <p className="mt-2.5 text-[48px] leading-none font-extrabold tracking-[-2.4px]">
          {formatDuration(durationSeconds, 'clock')}
        </p>
        <p data-testid="done-foot" className="mt-1.5 text-[13px] font-semibold opacity-80">
          {doneFootText(summary, results.length, unit)}
        </p>
      </HeroCard>

      <NewRecordsCard records={records} unit={unit} nameOf={nameOf} heading="h2" />

      <Card>
        <section aria-labelledby={stepsId}>
          <h2 id={stepsId}>
            <MicroLabel>Steps</MicroLabel>
          </h2>
          <ul className="mt-1">
            {results.map((result) => (
              <li
                key={result.step.slug}
                data-outcome={result.outcome}
                className="border-border flex min-h-11 items-center justify-between gap-3 border-b last:border-b-0"
              >
                <span className="min-w-0 text-sm break-words">{result.step.name}</span>
                <StepMark
                  status={MARK_STATUS[result.outcome]}
                  tone={result.outcome === 'done' ? 'text' : 'muted'}
                  label={
                    <>
                      {result.outcome === 'done' ? <span className="sr-only">Done, </span> : null}
                      {stepResultText(result, unit)}
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      </Card>

      <Link
        href={WORKOUTS_PATH}
        className="bg-accent text-accent-ink border-accent rounded-input inline-flex min-h-[54px] w-full items-center justify-center gap-2 border px-4 text-[15px] font-bold tracking-[-0.2px]"
      >
        {BACK_TO_WORKOUTS}
      </Link>
    </section>
  )
}
