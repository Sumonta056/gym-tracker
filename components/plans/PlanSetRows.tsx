'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { formatLoadShort, weightSymbol } from '../../lib/format/weight'
import { weightList } from '../../lib/plans/weights'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { SecondaryButton } from '../ui/SecondaryButton'
import { StatIcon } from '../ui/StatIcon'
import { draftFrom, readDraft } from '../workout/ExerciseCard'
import { loadText, repsText, setRowLabel, useSwipeOrHold } from '../workout/SetRow'

import type { WorkoutSet } from '../../lib/db/dexie'
import type { Equipment } from '../../lib/schema/plan'
import type { UnitSystem } from '../../lib/schema/profile'
import type { DraftText, SetValues } from '../workout/ExerciseCard'
import type { ChangeEvent } from 'react'

export const FIRST_TIME_HINT = 'Pick a light weight'

export const BODY_HINT = 'Body'

export const OTHER_WEIGHT = 'other'

export const OTHER_LABEL = 'Other…'

export const PICK_WEIGHT = 'Pick'

type CopySource = Pick<WorkoutSet, 'reps' | 'weight_kg'>

const ROW =
  'grid min-h-11 grid-cols-[18px_minmax(0,1fr)_72px_44px] items-center gap-1.5 min-[390px]:grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_44px] min-[390px]:gap-2'

const CELL =
  'bg-surface-2 border-border flex min-h-11 min-w-0 items-center gap-1 rounded-xl border px-2 text-[15px] font-bold whitespace-nowrap min-[390px]:px-3'

const FIELD =
  'bg-surface-2 border-border placeholder:text-dim min-h-11 w-full min-w-0 rounded-xl border pr-10 pl-2.5 text-[15px] font-bold placeholder:text-[13px] placeholder:font-medium min-[390px]:pr-11 min-[390px]:pl-3'

const SUFFIX =
  'text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium'

const SELECT =
  'bg-surface-2 border-border text-text min-h-11 w-full min-w-0 appearance-none rounded-xl border pr-7 pl-2.5 text-[15px] font-bold min-[390px]:pr-8 min-[390px]:pl-3'

const TICK = 'inline-flex size-11 items-center justify-center rounded-xl border font-extrabold'

export type WeightOption = { value: string; label: string }

export type WeightChoice = { options: WeightOption[]; selected: string }

function loadValue(kg: number, unit: UnitSystem): string {
  return draftFrom({ reps: 0, weight_kg: kg }, unit).load
}

export function weightOptions(
  list: readonly number[],
  load: string,
  unit: UnitSystem,
): WeightChoice {
  const symbol = weightSymbol(unit)
  const options = list.map((kg) => ({
    value: loadValue(kg, unit),
    label: `${formatLoadShort(kg, unit)} ${symbol}`,
  }))
  const typed = load.trim().replace(',', '.')

  if (typed === '') return { options, selected: '' }

  const shown = Number(typed)
  const match = options.find((option) => Number(option.value) === shown)

  if (match !== undefined) return { options, selected: match.value }

  const extra = { value: load, label: `${typed} ${symbol}` }
  const at = options.findIndex((option) => Number(option.value) > shown)

  return {
    options:
      at === -1 ? [...options, extra] : [...options.slice(0, at), extra, ...options.slice(at)],
    selected: load,
  }
}

export function weightLabel(position: number): string {
  return `Set ${String(position)} weight`
}

export function lastTimeLine(set: CopySource, unit: UnitSystem): string {
  const load =
    set.weight_kg === null
      ? 'body'
      : `${formatLoadShort(set.weight_kg, unit)} ${weightSymbol(unit)}`

  return `Last time ${load} × ${String(set.reps)}`
}

export type PlanSetRowsProps = {
  name: string
  unit: UnitSystem
  sets: readonly WorkoutSet[]
  drafts: readonly DraftText[]
  previous: CopySource | undefined
  equipment: Equipment
  busy?: boolean
  onDraftChange: (index: number, draft: DraftText) => void
  onLog: (index: number, values: SetValues) => void
  onAddRow: () => void
  onEdit: (set: WorkoutSet, position: number) => void
  onUndo: (set: WorkoutSet, position: number) => void
}

type RowErrors = { reps?: string; load?: string }

function WeightCell({
  draft,
  position,
  unit,
  list,
  invalid,
  describedBy,
  onChange,
}: {
  draft: DraftText
  position: number
  unit: UnitSystem
  list: readonly number[]
  invalid: boolean
  describedBy: string | undefined
  onChange: (draft: DraftText) => void
}) {
  const [typing, setTyping] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const typed = draft.load.trim().replace(',', '.')
  const unreadable = typed !== '' && !Number.isFinite(Number(typed))

  useEffect(() => {
    if (typing) field.current?.focus()
  }, [typing])

  if (typing || unreadable) {
    return (
      <label className="relative block min-w-0">
        <input
          ref={field}
          aria-label={weightLabel(position)}
          inputMode="decimal"
          autoComplete="off"
          value={draft.load}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange({ ...draft, load: event.target.value })
          }}
          className={FIELD}
        />
        {draft.load === '' ? null : <span className={SUFFIX}>{weightSymbol(unit)}</span>}
      </label>
    )
  }

  const { options, selected } = weightOptions(list, draft.load, unit)

  return (
    <span className="relative block min-w-0">
      <select
        aria-label={weightLabel(position)}
        value={selected}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          if (event.target.value === OTHER_WEIGHT) {
            setTyping(true)
            return
          }
          onChange({ ...draft, load: event.target.value })
        }}
        className={SELECT}
      >
        {selected === '' ? (
          <option value="" disabled>
            {PICK_WEIGHT}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={OTHER_WEIGHT}>{OTHER_LABEL}</option>
      </select>
      <StatIcon
        name="chevron"
        className="text-muted pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rotate-90 min-[390px]:right-3"
      />
    </span>
  )
}

function LoggedRow({
  set,
  position,
  unit,
  bodyweight,
  busy,
  onEdit,
  onUndo,
}: {
  set: WorkoutSet
  position: number
  unit: UnitSystem
  bodyweight: boolean
  busy: boolean
  onEdit: () => void
  onUndo: () => void
}) {
  const gestures = useSwipeOrHold(onEdit, onUndo)

  return (
    <li className={ROW}>
      <span className="text-muted text-xs font-bold">
        <span className="sr-only">Set </span>
        {position}
      </span>
      <button
        type="button"
        aria-label={setRowLabel(position, set, unit, false)}
        className="col-span-2 grid min-h-11 touch-pan-y grid-cols-[minmax(0,1fr)_72px] gap-1.5 text-left select-none [-webkit-touch-callout:none] min-[390px]:grid-cols-2 min-[390px]:gap-2"
        {...gestures}
      >
        <span className={CELL}>{bodyweight ? BODY_HINT : loadText(set.weight_kg, unit)}</span>
        <span className={CELL}>{repsText(set.reps)}</span>
      </button>
      <button
        type="button"
        aria-pressed="true"
        aria-label={`Set ${String(position)} done`}
        disabled={busy}
        onClick={onUndo}
        className={cn(TICK, 'bg-accent border-accent text-accent-ink')}
      >
        <span aria-hidden="true">✓</span>
      </button>
    </li>
  )
}

function DraftRow({
  draft,
  position,
  unit,
  bodyweight,
  list,
  hintId,
  errors,
  busy,
  onChange,
  onTick,
}: {
  draft: DraftText
  position: number
  unit: UnitSystem
  bodyweight: boolean
  list: readonly number[]
  hintId: string | undefined
  errors: RowErrors
  busy: boolean
  onChange: (draft: DraftText) => void
  onTick: () => void
}) {
  const errorId = useId()
  const hasError = errors.reps !== undefined || errors.load !== undefined
  const describe = (field: 'reps' | 'load') =>
    [
      errors[field] === undefined ? undefined : errorId,
      field === 'load' && draft.load === '' ? hintId : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <li className="flex flex-col gap-1">
      <div className={ROW}>
        <span className="text-dim text-xs font-bold">
          <span className="sr-only">Set </span>
          {position}
        </span>
        {bodyweight ? (
          <span data-testid="body-cell" className={CELL}>
            {BODY_HINT}
          </span>
        ) : (
          <WeightCell
            draft={draft}
            position={position}
            unit={unit}
            list={list}
            invalid={errors.load !== undefined}
            describedBy={describe('load')}
            onChange={onChange}
          />
        )}
        <label className="relative block min-w-0">
          <input
            aria-label={`Set ${String(position)} reps`}
            inputMode="numeric"
            autoComplete="off"
            value={draft.reps}
            aria-invalid={errors.reps === undefined ? undefined : true}
            aria-describedby={describe('reps')}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange({ ...draft, reps: event.target.value })
            }}
            className={FIELD}
          />
          <span className={SUFFIX}>reps</span>
        </label>
        <button
          type="button"
          aria-pressed="false"
          aria-label={`Set ${String(position)} done`}
          disabled={busy}
          onClick={onTick}
          className={cn(TICK, 'bg-surface-2 border-border text-dim disabled:opacity-50')}
        >
          <span aria-hidden="true">✓</span>
        </button>
      </div>
      {hasError ? (
        <p id={errorId} role="alert" className="text-danger pl-6 text-xs min-[390px]:pl-[42px]">
          {[errors.reps, errors.load].filter(Boolean).join(' ')}
        </p>
      ) : null}
    </li>
  )
}

export function PlanSetRows({
  name,
  unit,
  sets,
  drafts,
  previous,
  equipment,
  busy = false,
  onDraftChange,
  onLog,
  onAddRow,
  onEdit,
  onUndo,
}: PlanSetRowsProps) {
  const hintId = useId()
  const bodyweight = equipment === 'body only'
  const list = weightList(equipment)
  const [errors, setErrors] = useState<ReadonlyMap<number, RowErrors>>(new Map())
  const firstTime = previous === undefined && !bodyweight

  const tick = (index: number) => {
    const draft = drafts[index]

    if (draft === undefined) {
      return
    }

    const result = readDraft(bodyweight ? { ...draft, load: '' } : draft, unit, previous)

    if (!result.ok) {
      setErrors(new Map([[index, result.errors]]))
      return
    }

    setErrors(new Map())
    onLog(index, result.values)
  }

  return (
    <Card className="flex flex-col gap-2 px-3 min-[390px]:px-4">
      {firstTime && drafts.length > 0 ? (
        <p id={hintId} className="text-muted text-xs">
          {FIRST_TIME_HINT}
        </p>
      ) : null}
      <ol aria-label={`${name} sets`} className="flex flex-col gap-2">
        {sets.map((set, index) => (
          <LoggedRow
            key={set.id}
            set={set}
            position={index + 1}
            unit={unit}
            bodyweight={bodyweight}
            busy={busy}
            onEdit={() => {
              onEdit(set, index + 1)
            }}
            onUndo={() => {
              onUndo(set, index + 1)
            }}
          />
        ))}
        {drafts.map((draft, index) => (
          <DraftRow
            key={`draft-${String(sets.length + index)}`}
            draft={draft}
            position={sets.length + index + 1}
            unit={unit}
            bodyweight={bodyweight}
            list={list}
            hintId={firstTime ? hintId : undefined}
            errors={errors.get(index) ?? {}}
            busy={busy}
            onChange={(next) => {
              onDraftChange(index, next)
            }}
            onTick={() => {
              tick(index)
            }}
          />
        ))}
      </ol>
      <SecondaryButton onClick={onAddRow} className="mt-1">
        <span aria-hidden="true">+</span> Add set <span className="sr-only">to {name}</span>
      </SecondaryButton>
    </Card>
  )
}
