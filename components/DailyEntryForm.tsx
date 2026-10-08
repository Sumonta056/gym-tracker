'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { getDay, listSessions, upsertDay } from '../lib/db/repository'
import { formatDuration } from '../lib/duration'
import { effectiveGymSeconds } from '../lib/metrics/gymTime'
import { dailyEntrySchema, localDate, MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../lib/schema/dailyEntry'

import {
  CARDIO_PRESETS,
  DurationPicker,
  SESSION_PRESETS,
  SESSION_STEP_SECONDS,
} from './ui/DurationPicker'
import { Field } from './ui/Field'
import { MicroLabel } from './ui/MicroLabel'
import { NumberField } from './ui/NumberField'
import { PrimaryButton } from './ui/PrimaryButton'
import { SecondaryButton } from './ui/SecondaryButton'
import { StatusChip } from './ui/StatusChip'
import { SAVED_MESSAGE, useToast } from './ui/Toast'

import type { DailyEntry, WorkoutSession } from '../lib/db/dexie'
import type { DailyEntryDraft, DailyEntryInput } from '../lib/schema/dailyEntry'

export const WEIGHT_STEP = 0.05

export const FIELD_COUNT = 8

function toNumber(text: string): number | null {
  const raw = text.trim()

  return raw === '' ? null : Number(raw)
}

const formSchema = z
  .object({
    entry_date: z.string(),
    walk_seconds: z.number().nullable(),
    gym_seconds: z.number().nullable(),
    avg_heart_rate: z.string(),
    max_heart_rate: z.string(),
    weight_kg: z.string(),
    calories_burnt: z.string(),
    steps: z.string(),
    note: z.string(),
  })
  .transform((raw): DailyEntryDraft => ({
    entry_date: raw.entry_date,
    walk_seconds: raw.walk_seconds,
    gym_seconds: raw.gym_seconds,
    avg_heart_rate: toNumber(raw.avg_heart_rate),
    max_heart_rate: toNumber(raw.max_heart_rate),
    weight_kg: toNumber(raw.weight_kg),
    calories_burnt: toNumber(raw.calories_burnt),
    steps: toNumber(raw.steps),
    note: raw.note.trim() === '' ? null : raw.note.trim(),
  }))
  .pipe(dailyEntrySchema)

export type DailyEntryFormValues = z.input<typeof formSchema>

const EMPTY_VALUES: Omit<DailyEntryFormValues, 'entry_date'> = {
  walk_seconds: null,
  gym_seconds: null,
  avg_heart_rate: '',
  max_heart_rate: '',
  weight_kg: '',
  calories_burnt: '',
  steps: '',
  note: '',
}

export function toFormValues(entry: DailyEntry): DailyEntryFormValues {
  return {
    entry_date: entry.entry_date,
    walk_seconds: entry.walk_seconds,
    gym_seconds: entry.gym_seconds,
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

export function finishedCount(sessions: readonly WorkoutSession[]): number {
  return sessions.filter((session) => session.ended_at !== null && session.deleted_at === null)
    .length
}

export function sessionsText(count: number, seconds: number): string {
  const word = count === 1 ? '1 session' : `${String(count)} sessions`

  return `From ${word} · ${formatDuration(seconds, 'short')}`
}

const PILL =
  'bg-surface-2 border-border text-text inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 text-[13px] font-bold whitespace-nowrap'

export type DailyEntryFormProps = {
  date?: string
  readSessions?: (from: string, to: string) => Promise<WorkoutSession[]>
}

export function DailyEntryForm({ date, readSessions = listSessions }: DailyEntryFormProps) {
  const [entryDate] = useState(() => date ?? localDate())
  const toast = useToast()
  const [online, setOnline] = useState(true)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const loadedSwim = useRef<number | null>(null)
  const gymFocusPending = useRef(false)
  const setGymButton = useRef<HTMLButtonElement>(null)

  const {
    control,
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
          loadedSwim.current = entry.swim_seconds ?? null
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

  useEffect(() => {
    let cancelled = false

    void readSessions(entryDate, entryDate).then(
      (found) => {
        if (!cancelled) {
          setSessions(found)
        }
      },
      () => {
        if (!cancelled) {
          setSessions([])
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [entryDate, readSessions])

  const save = useCallback(
    (values: DailyEntryInput) => {
      setSaved(false)
      setSaveError(null)

      return upsertDay({ ...values, swim_seconds: loadedSwim.current }).then(
        () => {
          setSaved(true)
          toast.show(SAVED_MESSAGE)
        },
        (reason: unknown) => {
          setSaveError(reason instanceof Error ? reason.message : 'The entry could not be saved.')
        },
      )
    },
    [toast],
  )

  const weightText = watch('weight_kg')
  const weightNumber = Number(weightText.trim())
  const canNudge = weightText.trim() !== '' && Number.isFinite(weightNumber)
  const gymValue = watch('gym_seconds')
  const fromSessions = effectiveGymSeconds(undefined, sessions)
  const sessionCount = finishedCount(sessions)
  const gymFromSessions = gymValue === null && fromSessions.source === 'sessions'

  useEffect(() => {
    if (!gymFocusPending.current) {
      return
    }

    gymFocusPending.current = false

    if (gymFromSessions) {
      setGymButton.current?.focus()
    } else {
      document.getElementById('gym_seconds')?.focus()
    }
  }, [gymFromSessions])

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
          <h1 className="text-[23px] leading-tight font-bold tracking-[-0.6px]">Log</h1>
          <p className="text-muted mt-1 text-[13px]">
            {`${prettyDate(entryDate)} · ${String(FIELD_COUNT)} fields`}
          </p>
        </div>
        {online ? null : <StatusChip status="offline" className="mt-1 shrink-0" />}
      </header>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-3">
        {gymFromSessions ? (
          <div
            role="group"
            aria-labelledby="gym_seconds-label"
            className="flex w-full min-w-0 flex-col gap-[7px]"
          >
            <MicroLabel id="gym_seconds-label">Gym time</MicroLabel>
            <div className="bg-surface border-border rounded-input flex items-center justify-between gap-3 border p-3">
              <div className="min-w-0">
                <output className="text-text block text-lg font-extrabold tracking-[-0.4px]">
                  {formatDuration(fromSessions.seconds, 'clock')}
                </output>
                <p className="text-muted text-xs">
                  {sessionsText(sessionCount, fromSessions.seconds)}
                </p>
              </div>
              <button
                ref={setGymButton}
                type="button"
                className={PILL}
                onClick={() => {
                  gymFocusPending.current = true
                  setValue('gym_seconds', fromSessions.seconds, { shouldDirty: true })
                }}
              >
                Set a value
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Controller
              control={control}
              name="gym_seconds"
              render={({ field }) => (
                <DurationPicker
                  id="gym_seconds"
                  label="Gym time"
                  value={field.value}
                  onChange={(seconds) => {
                    gymFocusPending.current = seconds === null && fromSessions.source === 'sessions'
                    field.onChange(seconds)
                  }}
                  presets={SESSION_PRESETS}
                  step={SESSION_STEP_SECONDS}
                  allowClear
                />
              )}
            />
            {gymValue !== null && fromSessions.source === 'sessions' ? (
              <p className="text-muted text-xs">
                {`The sessions say ${formatDuration(fromSessions.seconds, 'short')}. Clear to use them.`}
              </p>
            ) : null}
          </div>
        )}

        <Controller
          control={control}
          name="walk_seconds"
          render={({ field }) => (
            <DurationPicker
              id="walk_seconds"
              label="Walk time"
              value={field.value}
              onChange={field.onChange}
              presets={CARDIO_PRESETS}
              step={SESSION_STEP_SECONDS}
              allowClear
            />
          )}
        />

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
              disabled={!canNudge}
              onClick={() => {
                nudge(-1)
              }}
            >
              −0.05 <span className="sr-only">kg, decrease the weight</span>
            </SecondaryButton>
            <SecondaryButton
              disabled={!canNudge}
              onClick={() => {
                nudge(1)
              }}
            >
              +0.05 <span className="sr-only">kg, increase the weight</span>
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
