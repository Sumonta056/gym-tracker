import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { combinePlans } from '../../lib/plans'
import { NO_RECORD, SUMMARY_TITLE } from '../workout/SessionSummary'

import { BACK_TO_WORKOUTS, doneFootText, PlanSessionDone, stepResultText } from './PlanSessionDone'

import type { PlanSessionSummary, StepResult } from '../../lib/metrics/planProgress'
import type { PlanStep } from '../../lib/schema/plan'

const PLAN = combinePlans(['chest-triceps'])

function stepAt(index: number): PlanStep {
  const step = PLAN.steps[index]
  if (step === undefined) throw new Error(`no step ${String(index)}`)
  return step
}

function result(index: number, patch: Partial<StepResult> = {}): StepResult {
  return { step: stepAt(index), outcome: 'done', setCount: 3, heaviestKg: 14, ...patch }
}

const SUMMARY: PlanSessionSummary = {
  doneSteps: 8,
  skippedSteps: 1,
  setCount: 25,
  volumeKg: 3420,
}

const RESULTS: StepResult[] = PLAN.steps.map((_, index) =>
  index === 2
    ? result(index, { outcome: 'skipped', setCount: 0, heaviestKg: null })
    : result(index),
)

function show(patch: Partial<Parameters<typeof PlanSessionDone>[0]> = {}) {
  render(
    <PlanSessionDone
      title="Chest + Triceps"
      durationSeconds={3068}
      summary={SUMMARY}
      results={RESULTS}
      records={[]}
      unit="metric"
      nameOf={() => 'Rope Pushdown'}
      {...patch}
    />,
  )
}

describe('doneFootText', () => {
  it('reads the volume, the sets and the steps done of the total', () => {
    expect(doneFootText(SUMMARY, 9, 'metric')).toBe('Volume 3,420 kg · 25 sets · 8 of 9 steps')
  })

  it('reads 0 of 9 steps with 0 sets', () => {
    expect(
      doneFootText({ doneSteps: 0, skippedSteps: 2, setCount: 0, volumeKg: 0 }, 9, 'metric'),
    ).toBe('Volume 0 kg · 0 sets · 0 of 9 steps')
  })

  it('reads 1 set in the singular', () => {
    expect(
      doneFootText({ doneSteps: 1, skippedSteps: 0, setCount: 1, volumeKg: 120 }, 9, 'metric'),
    ).toBe('Volume 120 kg · 1 set · 1 of 9 steps')
  })

  it('reads the volume in pounds under the imperial setting', () => {
    expect(doneFootText(SUMMARY, 9, 'imperial')).toBe('Volume 7,540 lb · 25 sets · 8 of 9 steps')
  })
})

describe('stepResultText', () => {
  it('reads sets × the heaviest weight for a done step', () => {
    expect(stepResultText(result(0), 'metric')).toBe('3 × 14 kg')
  })

  it('reads Body for a done step with no load', () => {
    expect(stepResultText(result(8, { heaviestKg: null }), 'metric')).toBe('3 × Body')
  })

  it('reads the weight in pounds under the imperial setting', () => {
    expect(stepResultText(result(0, { heaviestKg: 20 }), 'imperial')).toBe('3 × 44.1 lb')
  })

  it('reads Skipped and Not done by word', () => {
    expect(stepResultText(result(0, { outcome: 'skipped' }), 'metric')).toBe('Skipped')
    expect(stepResultText(result(0, { outcome: 'notDone' }), 'metric')).toBe('Not done')
  })
})

describe('PlanSessionDone', () => {
  it('heads the screen Session done over the plan title', () => {
    show()

    expect(screen.getByRole('heading', { level: 1, name: SUMMARY_TITLE })).toBeInTheDocument()
    expect(screen.getByText('Chest + Triceps')).toHaveClass('text-muted')
  })

  it('shows the gym time and the 8 of 9 line on the hero', () => {
    show()

    const hero = screen.getByRole('region', { name: 'Gym time' })
    expect(hero).toHaveClass('bg-accent')
    expect(hero).toHaveTextContent('51:08')
    expect(screen.getByTestId('done-foot')).toHaveTextContent(
      'Volume 3,420 kg · 25 sets · 8 of 9 steps',
    )
  })

  it('says so when there is no new record', () => {
    show()

    expect(screen.getByRole('heading', { level: 2, name: 'New records' })).toBeInTheDocument()
    expect(screen.getByText(NO_RECORD)).toBeInTheDocument()
  })

  it('lists a new record by name', () => {
    show({ records: [{ exerciseId: stepAt(6).exerciseId, weightKg: 20, reps: 12 }] })

    const records = screen.getByRole('heading', { level: 2, name: 'New records' }).parentElement
    expect(records).not.toBeNull()
    const row = within(records as HTMLElement).getByRole('listitem')
    expect(row).toHaveTextContent('Rope Pushdown')
    expect(within(row).getByText('20 kg × 12')).toHaveClass('text-accent')
  })

  it('lists 1 row per step in order, each mark a shape and a word', () => {
    show()

    const rows = within(screen.getByRole('region', { name: 'Steps' })).getAllByRole('listitem')
    expect(rows).toHaveLength(9)
    expect(rows[0]).toHaveTextContent(`${stepAt(0).name}✓Done, 3 × 14 kg`)
    expect(rows[2]).toHaveTextContent(`${stepAt(2).name}–Skipped`)
    expect(rows[2]?.querySelector('[aria-hidden="true"]')).toHaveClass('border-dashed')
  })

  it('marks a step never reached as not done', () => {
    show({ results: [result(0, { outcome: 'notDone', setCount: 0, heaviestKg: null })] })

    const row = within(screen.getByRole('region', { name: 'Steps' })).getByRole('listitem')
    expect(row).toHaveTextContent('○Not done')
    expect(row).toHaveAttribute('data-outcome', 'notDone')
  })

  it('links back to Workouts', () => {
    show()

    expect(screen.getByRole('link', { name: BACK_TO_WORKOUTS })).toHaveAttribute(
      'href',
      '/workouts',
    )
  })
})
