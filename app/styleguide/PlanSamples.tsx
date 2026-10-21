'use client'

import { useState } from 'react'

import { FinishConfirmSheet } from '../../components/plans/FinishConfirmSheet'
import { MuscleMap } from '../../components/plans/MuscleMap'
import { MuscleTags } from '../../components/plans/MuscleTags'
import { PlanCard } from '../../components/plans/PlanCard'
import { PlanSessionDone } from '../../components/plans/PlanSessionDone'
import { PlanSetRows } from '../../components/plans/PlanSetRows'
import { PlanStartBar } from '../../components/plans/PlanStartBar'
import { PlanStepList } from '../../components/plans/PlanStepList'
import { StepFrame } from '../../components/plans/StepFrame'
import { StepListPanel } from '../../components/plans/StepListPanel'
import { StepListSheet, StepMark } from '../../components/plans/StepListSheet'
import { StepProgress } from '../../components/plans/StepProgress'
import { SuggestedPlanHero } from '../../components/plans/SuggestedPlanHero'
import { WatchPill } from '../../components/plans/WatchPill'
import { Card } from '../../components/ui/Card'
import { MicroLabel } from '../../components/ui/MicroLabel'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { StatIcon } from '../../components/ui/StatIcon'
import { RestTimerCard } from '../../components/workout/RestTimerCard'
import { combinePlans, stepGroups } from '../../lib/plans'
import { COACH_PLANS } from '../../lib/plans/coach'

import type { DraftText } from '../../components/workout/ExerciseCard'
import type { WorkoutSet } from '../../lib/db/dexie'
import type { StepResult, StepStatus } from '../../lib/metrics/planProgress'
import type { PlanStep } from '../../lib/schema/plan'

const SAMPLE_TODAY = '2026-10-20'

const GUIDED = combinePlans(['chest-triceps'])

const GUIDED_GROUPS = stepGroups(['chest-triceps'])

const GUIDED_STATUSES: StepStatus[] = GUIDED.steps.map((_, index): StepStatus => {
  if (index === 0) return 'done'
  if (index === 1) return 'now'
  if (index === 2) return 'skipped'
  return 'todo'
})

const EVERY_STATUS: StepStatus[] = ['done', 'now', 'skipped', 'todo']

const SAMPLE_SET_AT = '2026-10-20T09:00:00.000Z'

const SAMPLE_REST_NOW = new Date(Date.parse(SAMPLE_SET_AT) + 42000)

function sampleRestNow(): Date {
  return SAMPLE_REST_NOW
}

function ignore(): void {
  return undefined
}

function stepAt(index: number): PlanStep | undefined {
  return GUIDED.steps[index]
}

function sampleSet(index: number, weight: number): WorkoutSet {
  return {
    id: `sample-set-${String(index)}`,
    session_id: 'sample-session',
    exercise_id: stepAt(1)?.exerciseId ?? '',
    set_index: index,
    reps: 12,
    weight_kg: weight,
    rpe: null,
    completed_at: SAMPLE_SET_AT,
    created_at: SAMPLE_SET_AT,
    updated_at: SAMPLE_SET_AT,
    deleted_at: null,
  }
}

const SAMPLE_LOGGED = [sampleSet(0, 20)]

const MUSCLE_SAMPLE_STEPS = COACH_PLANS.flatMap((plan) =>
  plan.groups.flatMap((group) => group.steps.map((step) => ({ plan, step }))),
)

export function MuscleMapSample() {
  const [slug, setSlug] = useState(MUSCLE_SAMPLE_STEPS[0]?.step.slug ?? '')
  const chosen = MUSCLE_SAMPLE_STEPS.find((entry) => entry.step.slug === slug)

  if (chosen === undefined) return null

  const { primary, secondary } = chosen.step.muscles

  return (
    <div data-testid="muscle-map-sample" className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <MicroLabel as="label" htmlFor="muscle-map-step" className="mb-1.5">
          Coach step
        </MicroLabel>
        <div className="relative md:max-w-md">
          <select
            id="muscle-map-step"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value)
            }}
            className="rounded-input border-border bg-surface text-text min-h-11 w-full appearance-none border pr-10 pl-3.5 text-base font-semibold"
          >
            {COACH_PLANS.map((plan) => (
              <optgroup key={plan.id} label={plan.title}>
                {plan.groups
                  .flatMap((group) => group.steps)
                  .map((step) => (
                    <option key={step.slug} value={step.slug}>
                      {step.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <StatIcon
            name="chevron"
            className="text-muted pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 rotate-90"
          />
        </div>
      </div>
      <Card>
        <MicroLabel as="p" className="mb-2">
          Frame · the Muscles view
        </MicroLabel>
        <div className="relative aspect-[16/9] overflow-hidden rounded-[14px]">
          <MuscleMap primary={primary} secondary={secondary} size="frame" />
        </div>
        <p className="text-text mt-3 text-[19px] font-bold tracking-[-0.4px]">{chosen.step.name}</p>
        <p className="text-text mt-1 text-[13.5px]">{chosen.step.how}</p>
        <MuscleTags primary={primary} secondary={secondary} className="mt-2.5" />
      </Card>
      <Card>
        <MicroLabel as="p" className="mb-2">
          Card · the laptop image row
        </MicroLabel>
        <div className="max-w-[220px] overflow-hidden rounded-[14px]">
          <MuscleMap primary={primary} secondary={secondary} size="card" />
        </div>
        <MicroLabel as="p" className="mt-4 mb-2">
          Chip · a plan card
        </MicroLabel>
        <MuscleMap primary={primary} secondary={secondary} size="chip" />
      </Card>
    </div>
  )
}

export function CoachPlanSample() {
  const [chest, back, shoulders, legs] = COACH_PLANS
  const [picked, setPicked] = useState(true)

  if (chest === undefined || back === undefined || shoulders === undefined || legs === undefined) {
    return null
  }

  const video = chest.groups[0]?.steps[0]?.video

  return (
    <div data-testid="coach-plan-sample" className="flex flex-col gap-3">
      <SuggestedPlanHero plan={legs} lastDone={undefined} today={SAMPLE_TODAY} />
      <ul aria-label="Sample plans" className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <li className="min-w-0">
          <PlanCard
            plan={legs}
            lastDone={undefined}
            today={SAMPLE_TODAY}
            selected={picked}
            onToggle={() => {
              setPicked((held) => !held)
            }}
          />
        </li>
        <li className="min-w-0">
          <PlanCard
            plan={chest}
            lastDone="2026-10-14"
            today={SAMPLE_TODAY}
            selected={false}
            onToggle={() => undefined}
          />
        </li>
      </ul>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <PlanStartBar plans={[]} />
        <PlanStartBar plans={[legs]} />
        <PlanStartBar plans={[shoulders, legs]} />
      </div>
      {video === undefined ? null : (
        <div className="flex items-center gap-3">
          <WatchPill name="Incline Dumbbell Press" video={video} />
          <span className="text-muted text-[13px]">Watch pill, a link out to a new tab</span>
        </div>
      )}
      <PlanStepList plan={back} />
    </div>
  )
}

export function GuidedStepSample() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [current, setCurrent] = useState(1)
  const step = stepAt(1)

  if (step === undefined) return null

  const statuses = GUIDED_STATUSES.map((status, index): StepStatus => {
    if (index === current) return 'now'
    return status === 'now' ? 'todo' : status
  })
  const notDone = GUIDED.steps.flatMap((held, index) =>
    statuses[index] === 'done'
      ? []
      : [{ index, name: held.name, status: statuses[index] ?? 'todo' }],
  )

  return (
    <div data-testid="guided-step-sample" className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <MicroLabel as="p" className="mb-2">
            Step frame · How to
          </MicroLabel>
          <StepFrame step={step} className="rounded-[14px]" />
        </Card>
        <Card>
          <MicroLabel as="p" className="mb-2">
            Step frame · Muscles
          </MicroLabel>
          <StepFrame step={step} initialView="muscles" className="rounded-[14px]" />
        </Card>
      </div>
      <Card>
        <MicroLabel as="p" className="mb-2">
          Step progress · done, now, skipped, to do
        </MicroLabel>
        <StepProgress names={GUIDED.steps.map((held) => held.name)} statuses={statuses} />
        <MicroLabel as="p" className="mt-4 mb-2">
          Step marks
        </MicroLabel>
        <ul aria-label="Step marks" className="flex flex-wrap gap-x-4 gap-y-2">
          {EVERY_STATUS.map((status) => (
            <li key={status}>
              <StepMark status={status} />
            </li>
          ))}
          <li>
            <StepMark status="todo" label="Not done" />
          </li>
        </ul>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        <SecondaryButton
          onClick={() => {
            setSheetOpen(true)
          }}
        >
          Open the step list sheet
        </SecondaryButton>
        <SecondaryButton
          onClick={() => {
            setFinishOpen(true)
          }}
        >
          Open the finish confirm sheet
        </SecondaryButton>
      </div>
      <div className="max-w-[360px]">
        <MicroLabel as="p" className="mb-2">
          Step list panel · 1024 px and up
        </MicroLabel>
        <StepListPanel
          steps={GUIDED.steps}
          groups={GUIDED_GROUPS}
          statuses={statuses}
          onPick={setCurrent}
        />
      </div>
      <StepListSheet
        open={sheetOpen}
        title={GUIDED.title}
        steps={GUIDED.steps}
        groups={GUIDED_GROUPS}
        statuses={statuses}
        onPick={(index) => {
          setCurrent(index)
          setSheetOpen(false)
        }}
        onClose={() => {
          setSheetOpen(false)
        }}
      />
      <FinishConfirmSheet
        open={finishOpen}
        notDone={notDone}
        setCount={SAMPLE_LOGGED.length}
        onFinish={() => {
          setFinishOpen(false)
        }}
        onClose={() => {
          setFinishOpen(false)
        }}
      />
    </div>
  )
}

export function SetRowsSample() {
  const [drafts, setDrafts] = useState<DraftText[]>([
    { reps: '12', load: '20' },
    { reps: '', load: '' },
  ])
  const step = stepAt(1)

  if (step === undefined) return null

  return (
    <div data-testid="set-rows-sample" className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card>
        <MicroLabel as="p" className="mb-2">
          Set rows · the weight list
        </MicroLabel>
        <PlanSetRows
          name={step.name}
          unit="metric"
          sets={SAMPLE_LOGGED}
          drafts={drafts}
          previous={{ reps: 12, weight_kg: 20 }}
          equipment={step.equipment}
          onDraftChange={(position, draft) => {
            setDrafts((held) => held.map((row, at) => (at === position ? draft : row)))
          }}
          onLog={ignore}
          onAddRow={() => {
            setDrafts((held) => [...held, { reps: '', load: '' }])
          }}
          onEdit={ignore}
          onUndo={ignore}
        />
      </Card>
      <div className="flex min-w-0 flex-col gap-3">
        <RestTimerCard
          exerciseName={step.name}
          completedAt={SAMPLE_SET_AT}
          restSeconds={90}
          savedSeconds={90}
          extraTaps={0}
          narrow
          now={sampleRestNow}
          onZero={ignore}
          onSkip={ignore}
          onAddThirty={ignore}
          onChange={ignore}
        />
        <p className="text-muted text-[13px]">
          The narrow rest card. From 1280 px it folds to 1 row: the time, Skip and +30 s.
        </p>
        <SecondaryButton>Secondary button</SecondaryButton>
        <SecondaryButton size="compact">Secondary button, compact</SecondaryButton>
      </div>
    </div>
  )
}

const DONE_RESULTS: StepResult[] = GUIDED.steps.map((step, index) => {
  if (index === 2) return { step, outcome: 'skipped', setCount: 0, heaviestKg: null }
  if (index >= GUIDED.steps.length - 2) {
    return { step, outcome: 'notDone', setCount: 0, heaviestKg: null }
  }
  return {
    step,
    outcome: 'done',
    setCount: 3,
    heaviestKg: step.bodyweight ? null : 14,
  }
})

export function PlanDoneSample() {
  const done = DONE_RESULTS.filter((result) => result.outcome === 'done')
  const first = done[0]

  return (
    <div data-testid="plan-done-sample">
      <PlanSessionDone
        title={GUIDED.title}
        durationSeconds={3068}
        summary={{
          doneSteps: done.length,
          skippedSteps: 1,
          setCount: done.length * 3,
          volumeKg: done.filter((result) => result.heaviestKg !== null).length * 3 * 12 * 14,
        }}
        results={DONE_RESULTS}
        records={
          first === undefined ? [] : [{ exerciseId: first.step.exerciseId, weightKg: 14, reps: 12 }]
        }
        unit="metric"
        nameOf={(id) => GUIDED.steps.find((step) => step.exerciseId === id)?.name ?? ''}
      />
    </div>
  )
}
