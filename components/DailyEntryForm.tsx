'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { getDay, upsertDay } from '../lib/db/repository'
import { formatDuration, parseInput } from '../lib/duration'
import { dailyEntrySchema, localDate, MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../lib/schema/dailyEntry'

import { DurationField } from './ui/DurationField'
import { Field } from './ui/Field'
import { MicroLabel } from './ui/MicroLabel'
import { NumberField } from './ui/NumberField'
import { PrimaryButton } from './ui/PrimaryButton'
import { SecondaryButton } from './ui/SecondaryButton'
import { StatusChip } from './ui/StatusChip'

import type { DailyEntry } from '../lib/db/dexie'
import type { DailyEntryDraft, DailyEntryInput } from '../lib/schema/dailyEntry'
import type { RefinementCtx } from 'zod'

export const WEIGHT_STEP = 0.05

export const FIELD_COUNT = 8

const EMPTY_VALUES = {
  walk_seconds: '',
  gym_seconds: '',
  avg_heart_rate: '',
  max_heart_rate: '',
  weight_kg: '',
  calories_burnt: '',
  steps: '',
  note: '',
}

function toSeconds(text: string, path: string, ctx: RefinementCtx): number | null {
  const raw = text.trim()

  if (raw === '') {
    return null
  }

  const parsed = parseInput(raw)

  if (!parsed.ok) {
    ctx.addIssue({ code: 'custom', path: [path], message: parsed.reason })
    return null
  }

  return parsed.seconds
}

function toNumber(text: string): number | null {
  const raw = text.trim()

  return raw === '' ? null : Number(raw)
}

const formSchema = z
  .object({
    entry_date: z.string(),
    walk_seconds: z.string(),
    gym_seconds: z.string(),
    avg_heart_rate: z.string(),
    max_heart_rate: z.string(),
    weight_kg: z.string(),
    calories_burnt: z.string(),
    steps: z.string(),
    note: z.string(),
  })
  .transform((raw, ctx): DailyEntryDraft => ({
    entry_date: raw.entry_date,
    walk_seconds: toSeconds(raw.walk_seconds, 'walk_seconds', ctx),
    gym_seconds: toSeconds(raw.gym_seconds, 'gym_seconds', ctx),
    avg_heart_rate: toNumber(raw.avg_heart_rate),
    max_heart_rate: toNumber(raw.max_heart_rate),
    weight_kg: toNumber(raw.weight_kg),
    calories_burnt: toNumber(raw.calories_burnt),
    steps: toNumber(raw.steps),
    note: raw.note.trim() === '' ? null : raw.note.trim(),
  }))
  .pipe(dailyEntrySchema)

export type DailyEntryFormValues = z.input<typeof formSchema>

export function toFormValues(entry: DailyEntry): DailyEntryFormValues {
  return {
    entry_date: entry.entry_date,
    walk_seconds: entry.walk_seconds === null ? '' : formatDuration(entry.walk_seconds, 'clock'),
    gym_seconds: entry.gym_seconds === null ? '' : formatDuration(entry.gym_seconds, 'clock'),
    avg_heart_rate: entry.avg_heart_rate === null ? '' : String(entry.avg_heart_rate),
    max_heart_rate: entry.max_heart_rate === null ? '' : String(entry.max_heart_rate),
    weight_kg: entry.weight_kg === null ? '' : entry.weight_kg.toFixed(2),
    calories_burnt: entry.calories_burnt === null ? '' : String(entry.calories_burnt),
    steps: entry.steps === null ? '' : String(entry.steps),
    note: entry.note ?? '',
  }
}

export function nextWeight(current: number, direction: 1 | -1): number {
  const moved = Math.round((current + direction * WEIGHT_STEP) * 100) / 100

  return Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, moved))
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function prettyDate(date: string): string {
  const at = new Date(`${date}T00:00:00Z`)

  const day = DAY_NAMES[at.getUTCDay()] ?? ''
  const month = MONTH_NAMES[at.getUTCMonth()] ?? ''

  return `${day} ${String(at.getUTCDate())} ${month}`
}

export type DailyEntryFormProps = {
  date?: string
}

export function DailyEntryForm({ date }: DailyEntryFormProps) {
  const [entryDate] = useState(() => date ?? localDate())
  const [online, setOnline] = useState(true)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<DailyEntryFormValues, unknown, DailyEntryInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...EMPTY_VALUES, entry_date: entryDate },
  })

  useEffect(() => {
    const read = (): void => {
      setOnline(globalThis.navigator.onLine)
    }

    read()
    window.addEventListener('online', read)
    window.addEventListener('offline', read)

    return () => {
      window.removeEventListener('online', read)
      window.removeEventListener('offline', read)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void getDay(entryDate).then(
      (entry) => {
        if (!cancelled && entry !== undefined) {
          reset(toFormValues(entry))
        }
      },
      () => {
        setSaveError('The saved entry for this day could not be read.')
      },
    )

    return () => {
      cancelled = true
    }
  }, [entryDate, reset])

  const save = useCallback((values: DailyEntryInput) => {
    setSaved(false)
    setSaveError(null)

    return upsertDay(values).then(
      () => {
        setSaved(true)
      },
      (reason: unknown) => {
        setSaveError(reason instanceof Error ? reason.message : 'The entry could not be saved.')
      },
    )
  }, [])

  const walkText = watch('walk_seconds')
  const gymText = watch('gym_seconds')
  const weightText = watch('weight_kg')
  const weightNumber = Number(weightText.trim())
  const canNudge = weightText.trim() !== '' && Number.isFinite(weightNumber)

  function nudge(direction: 1 | -1): void {
    if (!canNudge) {
      return
    }

    setValue('weight_kg', nextWeight(weightNumber, direction).toFixed(2), {
      shouldDirty: true,
    })
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(save)(event)
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <MicroLabel as="p">Gym Tracker</MicroLabel>
          <h1 className="mt-2 text-[23px] leading-tight font-bold tracking-[-0.6px]">Log</h1>
          <p className="text-muted mt-1 text-[13px]">
            {`${prettyDate(entryDate)} · ${String(FIELD_COUNT)} fields`}
          </p>
        </div>
        {online ? null : <StatusChip status="offline" className="mt-1 shrink-0" />}
      </header>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-3">
        <div className="grid grid-cols-2 gap-3">
          <DurationField
            label="Gym time"
            {...register('gym_seconds')}
            value={gymText}
            error={errors.gym_seconds?.message}
          />
          <DurationField
            label="Walk time"
            {...register('walk_seconds')}
            value={walkText}
            error={errors.walk_seconds?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Avg heart rate"
            inputMode="numeric"
            placeholder="118"
            {...register('avg_heart_rate')}
            error={errors.avg_heart_rate?.message}
          />
          <NumberField
            label="Max heart rate"
            inputMode="numeric"
            placeholder="164"
            {...register('max_heart_rate')}
            error={errors.max_heart_rate?.message}
          />
        </div>

        <div className="flex flex-col gap-2">
          <NumberField
            label="Weight (kg)"
            inputMode="decimal"
            placeholder="73.40"
            hint={canNudge ? undefined : 'Enter a weight to use the 0.05 steps.'}
            {...register('weight_kg')}
            error={errors.weight_kg?.message}
          />
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton
              aria-label="Decrease the weight by 0.05 kilograms"
              disabled={!canNudge}
              onClick={() => {
                nudge(-1)
              }}
            >
              −0.05
            </SecondaryButton>
            <SecondaryButton
              aria-label="Increase the weight by 0.05 kilograms"
              disabled={!canNudge}
              onClick={() => {
                nudge(1)
              }}
            >
              +0.05
            </SecondaryButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Calories"
            inputMode="numeric"
            placeholder="985"
            {...register('calories_burnt')}
            error={errors.calories_burnt?.message}
          />
          <NumberField
            label="Steps"
            inputMode="numeric"
            placeholder="12480"
            {...register('steps')}
            error={errors.steps?.message}
          />
        </div>

        <div className="md:col-span-2">
          <Field
            label="Note"
            type="text"
            autoComplete="off"
            placeholder="Push day. Bench felt light."
            {...register('note')}
            error={errors.note?.message}
          />
        </div>
      </div>

      <p className="text-muted mt-4 text-sm">
        Saved on this phone first. It uploads when the signal comes back, so nothing is lost with no
        network.
      </p>

      {errors.entry_date?.message === undefined ? null : (
        <p role="alert" className="text-danger mt-2 text-sm">
          {errors.entry_date.message}
        </p>
      )}

      {saveError === null ? null : (
        <p role="alert" className="text-danger mt-2 text-sm">
          {saveError}
        </p>
      )}

      <PrimaryButton type="submit" className="mt-4" disabled={isSubmitting}>
        Save entry
      </PrimaryButton>

      <p role="status" className="text-muted mt-2 min-h-5 text-sm">
        {saved ? 'Saved on this device.' : ''}
      </p>
    </form>
  )
}
