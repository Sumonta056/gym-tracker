'use client'

import { notFound } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AnalyticsHeader, AnalyticsView, RangeTabs } from '../../components/charts/Analytics'
import { LiftCharts } from '../../components/charts/LiftCharts'
import { analyse } from '../../components/charts/rangeData'
import { StepsChart } from '../../components/charts/StepsChart'
import { WeekCharts } from '../../components/charts/WeekCharts'
import { ImportConfirmSheet } from '../../components/csv/ImportConfirmSheet'
import { ImportConflict } from '../../components/csv/ImportConflict'
import { ImportReview } from '../../components/csv/ImportReview'
import { DailyEntryForm, nextWeight } from '../../components/DailyEntryForm'
import { DashboardView } from '../../components/dashboard/Dashboard'
import { DashboardHeader } from '../../components/dashboard/DashboardHeader'
import { HeartRateZonesCard } from '../../components/dashboard/HeartRateZonesCard'
import { ImportNoticeView } from '../../components/dashboard/ImportNotice'
import { TodayHero } from '../../components/dashboard/TodayHero'
import { WeekTotalsCard } from '../../components/dashboard/WeekTotalsCard'
import { DataCard } from '../../components/profile/DataCard'
import { ProfileView } from '../../components/profile/ProfileView'
import { SyncCard } from '../../components/profile/SyncCard'
import { AppShell } from '../../components/ui/AppShell'
import { BrandMark } from '../../components/ui/BrandMark'
import { Card } from '../../components/ui/Card'
import { DurationField } from '../../components/ui/DurationField'
import { EmailField } from '../../components/ui/EmailField'
import { HeroCard } from '../../components/ui/HeroCard'
import { MicroLabel } from '../../components/ui/MicroLabel'
import { NumberField } from '../../components/ui/NumberField'
import { PasswordField } from '../../components/ui/PasswordField'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { SegmentedTabs } from '../../components/ui/SegmentedTabs'
import { SheetModal } from '../../components/ui/SheetModal'
import { StatCard } from '../../components/ui/StatCard'
import { StatusChip } from '../../components/ui/StatusChip'
import { EditSetSheet } from '../../components/workout/EditSetSheet'
import { ExerciseCard } from '../../components/workout/ExerciseCard'
import { ExercisePicker } from '../../components/workout/ExercisePicker'
import { GymTimeOfferCard, GymTimeSheet } from '../../components/workout/GymTimeOffer'
import { RestTimerCard } from '../../components/workout/RestTimerCard'
import { RestTimeSheet } from '../../components/workout/RestTimeSheet'
import { SessionTimer } from '../../components/workout/SessionTimer'
import { UndoToast } from '../../components/workout/UndoToast'
import { SIGN_OUT_FAILED } from '../../lib/auth/browser'
import { colorTokens, radiusTokens } from '../../lib/design/tokens'
import { formatDuration, parseInput } from '../../lib/duration'

import type { RangeTab } from '../../components/charts/rangeData'
import type { LiftSource } from '../../components/charts/useLiftData'
import type { ImportSource } from '../../components/csv/ImportReview'
import type { DashboardSummary } from '../../components/dashboard/summary'
import type { ManageExerciseSource } from '../../components/profile/ManageExercisesSheet'
import type { EditingSet } from '../../components/workout/EditSetSheet'
import type { ExerciseSource } from '../../components/workout/ExercisePicker'
import type { Toast } from '../../components/workout/UndoToast'
import type {
  DailyEntry,
  DeadLetter,
  Exercise,
  Profile,
  WorkoutSession,
  WorkoutSet,
} from '../../lib/db/dexie'
import type { ImportChoice } from '../../lib/db/repository'
import type { MuscleGroup } from '../../lib/schema/exercise'
import type { UnitSystem } from '../../lib/schema/profile'
import type { GymTimeOffer } from '../../lib/workout/gymTime'
import type { ReactNode } from 'react'

const NAV = [
  { href: '/', label: 'Today', glyph: '◧', current: false },
  { href: '/analytics', label: 'Stats', glyph: '◔' },
  { href: '/workouts', label: 'Workouts', glyph: '⛊' },
  { href: '/styleguide', label: 'Style guide', glyph: '☰', current: true },
]

const SAMPLE_DAY: DailyEntry = {
  id: '00000000-0000-4000-8000-000000000001',
  entry_date: '2026-09-13',
  walk_seconds: 3324,
  gym_seconds: 4325,
  avg_heart_rate: 117,
  max_heart_rate: 174,
  weight_kg: 73.65,
  calories_burnt: 963,
  steps: 5909,
  note: null,
  created_at: '2026-09-13T10:00:00.000Z',
  updated_at: '2026-09-13T10:00:00.000Z',
  deleted_at: null,
}

const SAMPLE_DEAD_LETTER: DeadLetter = {
  id: '00000000-0000-4000-8000-000000000002',
  sequence: 7,
  table_name: 'daily_entries',
  operation: 'upsert',
  row_id: SAMPLE_DAY.id,
  payload: SAMPLE_DAY,
  created_at: '2026-09-13T10:00:00.000Z',
  attempts: 1,
  last_error: 'new row violates row-level security policy for table "daily_entries"',
  next_attempt_at: null,
  error_code: '42501',
  failed_at: '2026-09-13T10:00:05.000Z',
}

const SAMPLE_IMPORT_SHEET = [
  'Day,Walk Time,Gym Time,Avg Heart Rate,Highest Rate,Weight,Calories Burnt,Steps',
  'August 12,15.54,1:03:13,117,174,73.65,963,5909',
  'August 15,12.40,1:15:37,121,168,73.40,880,7120',
  'August 18,20,1:02:09,118,166,73.20,904,5.9k',
  'August 20,18.75,1:44:50,124,171,73.10,1012,"11,482"',
].join('\n')

function sampleImportSource(): ImportSource {
  return {
    firstPullDone: () => Promise.resolve(true),
    loggedDates: () => Promise.resolve(new Set(['2026-08-20'])),
    importDays: (days) =>
      Promise.resolve({
        created: days.filter((day) => day.choice === undefined).length,
        overwritten: days.filter((day) => day.choice === 'overwrite').length,
        merged: days.filter((day) => day.choice === 'merge').length,
        skipped: days.filter((day) => day.choice === 'skip').length,
      }),
  }
}

function ignoreImport(): void {
  return undefined
}

const SAMPLE_IMPORT_COUNTS = { created: 12, overwritten: 1, merged: 2, skipped: 1, leftOut: 1 }

const SAMPLE_ZONES = {
  warmSeconds: 480,
  fatBurnSeconds: 2280,
  cardioSeconds: 1260,
  peakSeconds: 300,
}

const SAMPLE_STATS_TODAY = '2026-09-20'

const SAMPLE_STATS_NOW = new Date(2026, 8, 20, 10, 0, 0)

const SAMPLE_STATS_DAYS: [string, Partial<DailyEntry>][] = [
  ['2026-09-09', { weight_kg: 74.6 }],
  ['2026-09-10', { weight_kg: 74.4 }],
  ['2026-09-11', { weight_kg: 74.5 }],
  ['2026-09-12', { weight_kg: 74.3 }],
  ['2026-09-13', { weight_kg: 74.2 }],
  [
    '2026-09-14',
    { weight_kg: 74.1, calories_burnt: 620, steps: 9120, avg_heart_rate: 114, max_heart_rate: 162 },
  ],
  [
    '2026-09-15',
    {
      weight_kg: 73.9,
      calories_burnt: 780,
      steps: 11400,
      avg_heart_rate: 116,
      max_heart_rate: 158,
    },
  ],
  [
    '2026-09-16',
    {
      weight_kg: 74.2,
      calories_burnt: 410,
      steps: 6900,
      gym_seconds: null,
      avg_heart_rate: 112,
      max_heart_rate: 171,
    },
  ],
  [
    '2026-09-17',
    {
      weight_kg: 73.7,
      calories_burnt: 985,
      steps: 12480,
      avg_heart_rate: 118,
      max_heart_rate: 160,
    },
  ],
  [
    '2026-09-18',
    { weight_kg: 73.6, calories_burnt: 540, steps: 8300, avg_heart_rate: 115, max_heart_rate: 165 },
  ],
  [
    '2026-09-19',
    {
      weight_kg: 73.5,
      calories_burnt: 900,
      steps: 13100,
      avg_heart_rate: 117,
      max_heart_rate: 159,
    },
  ],
  [
    '2026-09-20',
    { weight_kg: 73.4, calories_burnt: 705, steps: 9904, avg_heart_rate: 113, max_heart_rate: 168 },
  ],
]

const SAMPLE_STATS_ENTRIES: DailyEntry[] = SAMPLE_STATS_DAYS.map(([date, patch], index) => ({
  ...SAMPLE_DAY,
  id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
  entry_date: date,
  ...patch,
}))

const SAMPLE_STEP_GOAL = 12000

const SAMPLE_ONE_DAY = SAMPLE_STATS_ENTRIES.filter((row) => row.entry_date === SAMPLE_STATS_TODAY)

const SAMPLE_HEAVY_ENTRIES: DailyEntry[] = SAMPLE_STATS_ENTRIES.map((row, index) => ({
  ...row,
  id: `00000000-0000-4000-8000-${String(index + 200).padStart(12, '0')}`,
  weight_kg: 104.6 - index * 0.3,
  calories_burnt: 1180 + index * 37,
  steps: 12480 + index * 413,
}))

const SAMPLE_HEAVY_DAY: DailyEntry = {
  ...SAMPLE_DAY,
  gym_seconds: 5400,
  weight_kg: 103.4,
  steps: 13100,
  calories_burnt: 1285,
}

const SAMPLE_HEAVY_SUMMARY: DashboardSummary = {
  today: SAMPLE_HEAVY_DAY.entry_date,
  entry: SAMPLE_HEAVY_DAY,
  streak: 12,
  zones: { warmSeconds: 600, fatBurnSeconds: 2700, cardioSeconds: 1680, peakSeconds: 420 },
  week: { sessions: 6, gymSeconds: 25920, walkSeconds: 19440, calories: 7710, steps: 78600 },
  weekRange: { from: '2026-09-07', to: '2026-09-13' },
  stepGoal: 12000,
  latestWeightKg: SAMPLE_HEAVY_DAY.weight_kg,
  weightTrend: [104.6, 104.3, 104.1, 103.9, 103.4],
  displayName: 'Sumonta',
  unitSystem: 'metric',
}

const SAMPLE_LIFT_DATES = [
  '2026-09-02',
  '2026-09-03',
  '2026-09-06',
  '2026-09-09',
  '2026-09-12',
  '2026-09-13',
  '2026-09-15',
  '2026-09-17',
  '2026-09-20',
]

const SAMPLE_LIFT_EXERCISES: Exercise[] = [
  ['00000000-0000-4000-8000-000000000301', 'Bench press', 'chest'],
  ['00000000-0000-4000-8000-000000000302', 'Lat pulldown', 'back'],
  ['00000000-0000-4000-8000-000000000303', 'Leg press', 'legs'],
].map(([id, name, group]) => ({
  id: id ?? '',
  user_id: null,
  name: name ?? '',
  muscle_group: group as MuscleGroup,
  is_archived: false,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
}))

const SAMPLE_LIFT_SESSIONS: WorkoutSession[] = SAMPLE_LIFT_DATES.map((date, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 400).padStart(12, '0')}`,
  entry_date: date,
  started_at: `${date}T12:00:00.000Z`,
  ended_at: `${date}T13:00:00.000Z`,
  status: 'finished',
  created_at: `${date}T12:00:00.000Z`,
  updated_at: `${date}T13:00:00.000Z`,
  deleted_at: null,
}))

function sampleLiftSet(
  session: WorkoutSession,
  exercise: number,
  order: number,
  reps: number,
  weightKg: number,
): WorkoutSet {
  const minute = String(exercise * 10 + order).padStart(2, '0')

  return {
    id: `${session.id.slice(0, -4)}${String(exercise)}${String(order).padStart(3, '0')}`,
    session_id: session.id,
    exercise_id: SAMPLE_LIFT_EXERCISES[exercise]?.id ?? '',
    set_index: exercise * 10 + order,
    reps,
    weight_kg: weightKg,
    rpe: null,
    completed_at: `${session.entry_date}T12:${minute}:00.000Z`,
    created_at: `${session.entry_date}T12:${minute}:00.000Z`,
    updated_at: `${session.entry_date}T12:${minute}:00.000Z`,
    deleted_at: null,
  }
}

const SAMPLE_LIFT_SETS: WorkoutSet[] = SAMPLE_LIFT_SESSIONS.flatMap((session, index) => [
  ...[0, 1, 2].map((order) => sampleLiftSet(session, 0, order, 8, 37.5 + index * 1.25)),
  ...[0, 1, 2].map((order) => sampleLiftSet(session, 1, order, 12, 30 + (index % 4) * 1.25)),
  ...(index % 3 === 0 ? [sampleLiftSet(session, 2, 0, 10, 70 + index * 2.5)] : []),
])

const SAMPLE_LIFTS: LiftSource = {
  sessions: SAMPLE_LIFT_SESSIONS,
  sets: SAMPLE_LIFT_SETS,
  exercises: SAMPLE_LIFT_EXERCISES,
}

const SAMPLE_ONE_SESSION: LiftSource = {
  sessions: SAMPLE_LIFT_SESSIONS.filter((session) => session.entry_date === SAMPLE_STATS_TODAY),
  sets: SAMPLE_LIFT_SETS.filter((set) => set.session_id === SAMPLE_LIFT_SESSIONS.at(-1)?.id),
  exercises: SAMPLE_LIFT_EXERCISES,
}

const SAMPLE_NO_LIFTS: LiftSource = { sessions: [], sets: [], exercises: SAMPLE_LIFT_EXERCISES }

const SAMPLE_WEEK_TODAY = '2026-09-13'

const SAMPLE_WEEK_NOW = new Date(2026, 8, 13, 18, 0, 0)

const SAMPLE_WEEK_DAYS: [string, number | null, number][] = [
  ['2026-09-02', 3600, 804],
  ['2026-09-03', 3600, 726],
  ['2026-09-06', 3600, 834],
  ['2026-09-09', null, 629],
  ['2026-09-12', 3600, 798],
  ['2026-09-13', 3600, 852],
]

const SAMPLE_WEEK_ENTRIES: DailyEntry[] = SAMPLE_WEEK_DAYS.map(
  ([date, gymSeconds, calories], index) => ({
    ...SAMPLE_DAY,
    id: `00000000-0000-4000-8000-${String(index + 500).padStart(12, '0')}`,
    entry_date: date,
    gym_seconds: gymSeconds,
    calories_burnt: calories,
  }),
)

const SAMPLE_WEEK_ONE_DAY = SAMPLE_WEEK_ENTRIES.filter(
  (row) => row.entry_date === SAMPLE_WEEK_TODAY,
)

const SAMPLE_WEEK_ONE_SESSION: LiftSource = {
  sessions: SAMPLE_LIFT_SESSIONS.filter((session) => session.entry_date === SAMPLE_WEEK_TODAY),
  sets: SAMPLE_LIFT_SETS.filter((set) =>
    SAMPLE_LIFT_SESSIONS.some(
      (session) => session.id === set.session_id && session.entry_date === SAMPLE_WEEK_TODAY,
    ),
  ),
  exercises: SAMPLE_LIFT_EXERCISES,
}

function sampleWeekDays(entries: DailyEntry[], tab: RangeTab) {
  return analyse(entries, entries, tab, SAMPLE_WEEK_TODAY, SAMPLE_WEEK_NOW, SAMPLE_STEP_GOAL).days
}

function sampleStats(entries: DailyEntry[], tab: RangeTab) {
  return analyse(entries, entries, tab, SAMPLE_STATS_TODAY, SAMPLE_STATS_NOW, SAMPLE_STEP_GOAL)
}

const SAMPLE_PROFILE: Profile = {
  id: '00000000-0000-4000-8000-000000000000',
  display_name: 'Sumonta',
  unit_system: 'metric',
  height_cm: 174,
  target_weight_kg: 71,
  step_goal: 12000,
  updated_at: '2026-09-20T10:00:00.000Z',
}

const SAMPLE_WEEK = { sessions: 3, gymSeconds: 9120, walkSeconds: 0, calories: 2627, steps: 21480 }

const RANGES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const TYPE_STEPS = [
  { name: 'Hero number', className: 'text-[44px] leading-none font-extrabold' },
  { name: 'Stat number', className: 'text-[25px] leading-none font-extrabold' },
  { name: 'Title', className: 'text-2xl font-extrabold' },
  { name: 'Body text', className: 'text-base font-normal' },
  { name: 'Small', className: 'text-sm font-normal' },
  { name: 'Caption', className: 'text-xs font-normal' },
]

const SAMPLE_PICKER_NOW = new Date(2026, 8, 20, 18, 0, 0)

const SAMPLE_EXERCISE_ROWS: [string, MuscleGroup][] = [
  ['Bench Press', 'chest'],
  ['Lat Pulldown', 'back'],
  ['Back Squat', 'legs'],
  ['Overhead Press', 'shoulders'],
  ['Incline Dumbbell Press', 'chest'],
  ['Seated Cable Row', 'back'],
  ['Romanian Deadlift', 'legs'],
  ['Lateral Raise', 'shoulders'],
  ['Barbell Curl', 'arms'],
  ['Cable Crunch', 'core'],
  ['Rowing Machine', 'cardio'],
]

const SAMPLE_EXERCISES: Exercise[] = SAMPLE_EXERCISE_ROWS.map(([name, muscle_group], at) => ({
  id: `30000000-0000-4000-8000-${String(at + 1).padStart(12, '0')}`,
  name,
  muscle_group,
  is_archived: false,
  user_id: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
}))

const SAMPLE_LAST_SETS: [number, number, number, number][] = [
  [0, 18, 75, 8],
  [1, 16, 60, 10],
  [2, 15, 90, 6],
  [3, 13, 40, 10],
]

function sampleLastSet([at, day, weight_kg, reps]: [number, number, number, number]): WorkoutSet {
  const exercise = SAMPLE_EXERCISES[at] as Exercise
  const when = new Date(2026, 8, day, 18, 0, 0).toISOString()

  return {
    id: `40000000-0000-4000-8000-${String(at + 1).padStart(12, '0')}`,
    session_id: '50000000-0000-4000-8000-000000000001',
    exercise_id: exercise.id,
    set_index: 0,
    reps,
    weight_kg,
    rpe: null,
    completed_at: when,
    created_at: when,
    updated_at: when,
    deleted_at: null,
  }
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function sampleExerciseSource(): ExerciseSource {
  const rows = [...SAMPLE_EXERCISES]
  const sets = new Map(
    SAMPLE_LAST_SETS.map((entry) => {
      const set = sampleLastSet(entry)
      return [set.exercise_id, set] as const
    }),
  )

  return {
    listExercises: (filter) =>
      Promise.resolve(
        rows
          .filter(
            (row) =>
              (filter.muscleGroup === undefined || row.muscle_group === filter.muscleGroup) &&
              plain(row.name).includes(plain(filter.query ?? '')),
          )
          .sort((left, right) => left.name.localeCompare(right.name)),
      ),
    lastSetsFor: (exerciseIds) =>
      Promise.resolve(
        new Map(
          exerciseIds.flatMap((id) => {
            const set = sets.get(id)
            return set === undefined ? [] : [[id, set] as const]
          }),
        ),
      ),
    createExercise: (input) => {
      const row: Exercise = {
        ...input,
        id: `30000000-0000-4000-8000-${String(rows.length + 1).padStart(12, '0')}`,
        user_id: 'local',
        created_at: SAMPLE_PICKER_NOW.toISOString(),
        updated_at: SAMPLE_PICKER_NOW.toISOString(),
        deleted_at: null,
      }
      rows.push(row)
      return Promise.resolve(row)
    },
  }
}

const SAMPLE_SESSION_START = new Date(2026, 8, 20, 17, 30, 0).toISOString()

const SAMPLE_GYM_OFFER: GymTimeOffer = {
  sessionId: '00000000-0000-4000-8000-0000000000aa',
  entryDate: '2026-09-20',
  sessionSeconds: 4325,
  loggedSeconds: 3900,
}

const SAMPLE_SESSION_NOW = new Date(2026, 8, 20, 18, 12, 17)

function sampleSessionNow(): Date {
  return SAMPLE_SESSION_NOW
}

const SAMPLE_REST_COMPLETED_AT = new Date(SAMPLE_SESSION_NOW.getTime() - 6000).toISOString()

const SAMPLE_REST_EXERCISE_ID = '33333333-3333-4333-8333-333333333333'

const SAMPLE_LIVE_SETS: WorkoutSet[] = (
  [
    [60, 12],
    [70, 10],
    [75, 8],
  ] as const
).map(([weight_kg, reps], at) => ({
  id: `70000000-0000-4000-8000-${String(at + 1).padStart(12, '0')}`,
  session_id: '70000000-0000-4000-8000-000000000000',
  exercise_id: '70000000-0000-4000-8000-000000000099',
  set_index: at,
  reps,
  weight_kg,
  rpe: null,
  completed_at: SAMPLE_SESSION_START,
  created_at: SAMPLE_SESSION_START,
  updated_at: SAMPLE_SESSION_START,
  deleted_at: null,
}))

const SAMPLE_LIVE_RECORDS = new Set([SAMPLE_LIVE_SETS[2]?.id ?? ''])

const SAMPLE_OWN_EXERCISES: Exercise[] = (
  [
    ['Cable Fly', 'chest', false],
    ['Incline Dumbbell', 'chest', false],
    ['Hip Thrust Machine', 'legs', true],
  ] as const
).map(([name, muscle_group, is_archived], at) => ({
  id: `60000000-0000-4000-8000-${String(at + 1).padStart(12, '0')}`,
  name,
  muscle_group,
  is_archived,
  user_id: 'local',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
}))

function sampleManageSource(): ManageExerciseSource {
  let rows = [...SAMPLE_OWN_EXERCISES, ...SAMPLE_EXERCISES]

  function change(id: string, patch: Partial<Exercise>): Exercise {
    rows = rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    return rows.find((row) => row.id === id) as Exercise
  }

  return {
    listExercises: () =>
      Promise.resolve([...rows].sort((left, right) => left.name.localeCompare(right.name))),
    renameExercise: (id, name) => Promise.resolve(change(id, { name })),
    archiveExercise: (id) => {
      change(id, { is_archived: true })
      return Promise.resolve()
    },
    restoreExercise: (id) => {
      change(id, { is_archived: false })
      return Promise.resolve()
    },
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-text mb-3 text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

export default function StyleguidePage() {
  if (!process.env.NEXT_PUBLIC_ENABLE_STYLEGUIDE) {
    notFound()
  }

  return <Styleguide />
}

function Styleguide() {
  const [range, setRange] = useState('week')
  const [statsTab, setStatsTab] = useState<RangeTab>('week')
  const stats = sampleStats(SAMPLE_STATS_ENTRIES, statsTab)
  const oneDay = sampleStats(SAMPLE_ONE_DAY, statsTab)
  const heavy = analyse(
    SAMPLE_HEAVY_ENTRIES,
    SAMPLE_HEAVY_ENTRIES,
    statsTab,
    SAMPLE_STATS_TODAY,
    SAMPLE_STATS_NOW,
    SAMPLE_STEP_GOAL,
    'imperial',
  )
  const [durationText, setDurationText] = useState(formatDuration(4325, 'clock'))
  const [nudgeWeight, setNudgeWeight] = useState(73.4)
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [sampleEditing, setSampleEditing] = useState<EditingSet | null>(null)
  const [sampleToast, setSampleToast] = useState<Toast | null>(null)
  const [sampleRestTaps, setSampleRestTaps] = useState(0)
  const [sampleRestSkipped, setSampleRestSkipped] = useState(false)
  const [sampleRestSeconds, setSampleRestSeconds] = useState(90)
  const [sampleChangingRest, setSampleChangingRest] = useState(false)
  const [sampleOfferOpen, setSampleOfferOpen] = useState(false)
  const [sampleOfferUsed, setSampleOfferUsed] = useState(false)
  const [pickerSource] = useState(sampleExerciseSource)
  const [manageSource] = useState(sampleManageSource)
  const [importSource] = useState(sampleImportSource)
  const [sampleChoice, setSampleChoice] = useState<ImportChoice | null>(null)
  const [sampleConfirmOpen, setSampleConfirmOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])
  const [showFieldError, setShowFieldError] = useState(false)
  const [showEmailError, setShowEmailError] = useState(false)
  const [sampleProfile, setSampleProfile] = useState<Profile>(SAMPLE_PROFILE)
  const [samplePending, setSamplePending] = useState(0)
  const [showSignOutError, setShowSignOutError] = useState(false)
  const [sampleLost, setSampleLost] = useState<number | null>(null)
  const parsedDuration = parseInput(durationText.trim())
  const storedSeconds = parsedDuration.ok ? parsedDuration.seconds : null

  return (
    <AppShell
      items={NAV}
      action={{ href: '/log', label: 'Log the day', glyph: '✎' }}
      title="Style guide"
    >
      <Section title="Colour tokens">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Object.entries(colorTokens).map(([name, value]) => (
            <li key={name}>
              <Card className="flex flex-col gap-2 p-3">
                <span
                  aria-hidden="true"
                  className="border-border h-12 w-full rounded-xl border"
                  style={{ backgroundColor: value }}
                />
                <MicroLabel>{name}</MicroLabel>
                <span className="text-muted text-xs">{value}</span>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Radius tokens">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(radiusTokens).map(([name, value]) => (
            <li key={name}>
              <Card className="flex items-center justify-between">
                <MicroLabel>{name}</MicroLabel>
                <span className="text-muted text-xs">{value}</span>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type scale">
        <Card>
          <ul className="flex flex-col gap-4">
            {TYPE_STEPS.map((step) => (
              <li key={step.name} className="flex flex-col gap-1">
                <MicroLabel>{step.name}</MicroLabel>
                <span className={step.className}>1 234.5</span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <HeroCard label="Gym time today">
            <p className="text-[44px] leading-none font-extrabold">1:12:05</p>
            <p className="text-accent-ink/70 mt-1 text-sm font-semibold">
              {formatDuration(4325, 'short')}
            </p>
          </HeroCard>
          <Card>
            <MicroLabel>Card</MicroLabel>
            <p className="text-text mt-2 text-base">Surface, one pixel border, 20 px radius.</p>
          </Card>
          <Card selected>
            <MicroLabel>Card, selected</MicroLabel>
            <p className="text-text mt-2 text-base">The accent border marks the selection.</p>
          </Card>
          <Card tone="rest" data-testid="card-rest-tone">
            <MicroLabel>Card, rest tone</MicroLabel>
            <p className="text-text mt-2 text-base">
              Cyan mixed into the surface and the border. The rest timer only.
            </p>
          </Card>
        </div>
      </Section>

      <Section title="Stat cards">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Steps" value="8,240" hint="Goal 10,000" progress={0.82} />
          <StatCard label="Body weight" value="82.4" unit="kg" tone="violet" hint="7 day average" />
          <StatCard
            label="Volume load"
            value="12,400"
            unit="kg"
            tone="cyan"
            sparkline={[8, 11, 9, 14, 12, 16]}
          />
        </div>
      </Section>

      <Section title="Dashboard">
        <Card className="mb-3">
          <DashboardHeader date="2026-09-13" displayName="Sumonta" />
        </Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <TodayHero entry={SAMPLE_DAY} streak={4} name="Today, logged" />
          <TodayHero entry={undefined} streak={0} name="Today, empty state" />
          <HeartRateZonesCard zones={SAMPLE_ZONES} />
          <WeekTotalsCard totals={SAMPLE_WEEK} className="md:col-span-2 lg:col-span-3" />
        </div>
        <h3 className="text-text mt-6 text-base font-bold">The full screen, a heavy day</h3>
        <div className="mt-4" data-testid="dashboard-sample">
          <DashboardView summary={SAMPLE_HEAVY_SUMMARY} />
        </div>
      </Section>

      <Section title="Analytics">
        <Card className="mb-3">
          <AnalyticsHeader label={stats.label} />
          <RangeTabs value={statsTab} onValueChange={setStatsTab} />
        </Card>
        <AnalyticsView data={stats} />
        <LiftCharts source={SAMPLE_LIFTS} tab={statsTab} today={SAMPLE_STATS_TODAY} />
        <h3 className="text-text mt-6 text-base font-bold">The week charts, 2 to 13 September</h3>
        <WeekCharts
          source={SAMPLE_LIFTS}
          days={sampleWeekDays(SAMPLE_WEEK_ENTRIES, statsTab)}
          today={SAMPLE_WEEK_TODAY}
        />
        <h3 className="text-text mt-6 text-base font-bold">The week charts, one session</h3>
        <WeekCharts
          source={SAMPLE_WEEK_ONE_SESSION}
          days={sampleWeekDays(SAMPLE_WEEK_ONE_DAY, statsTab)}
          today={SAMPLE_WEEK_TODAY}
          testId="week-grid-one-session"
        />
        <h3 className="text-text mt-6 text-base font-bold">One logged day</h3>
        <AnalyticsView data={oneDay} testId="analytics-grid-one-day" />
        <LiftCharts
          source={SAMPLE_ONE_SESSION}
          tab={statsTab}
          today={SAMPLE_STATS_TODAY}
          testId="lift-grid-one-session"
        />
        <h3 className="text-text mt-6 text-base font-bold">A heavy week, in pounds</h3>
        <AnalyticsView data={heavy} testId="analytics-grid-heavy" />
        <LiftCharts
          source={SAMPLE_LIFTS}
          tab={statsTab}
          today={SAMPLE_STATS_TODAY}
          unit="imperial"
          testId="lift-grid-heavy"
        />
        <h3 className="text-text mt-6 text-base font-bold">Nothing logged</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <StepsChart days={[]} tab="week" stepGoal={SAMPLE_STEP_GOAL} />
        </div>
        <LiftCharts
          source={SAMPLE_NO_LIFTS}
          tab={statsTab}
          today={SAMPLE_STATS_TODAY}
          testId="lift-grid-empty"
        />
        <WeekCharts
          source={SAMPLE_NO_LIFTS}
          days={sampleWeekDays([], statsTab)}
          today={SAMPLE_WEEK_TODAY}
          testId="week-grid-empty"
        />
      </Section>

      <Section title="Daily log">
        <div data-testid="log-sample">
          <DailyEntryForm date="2026-09-13" />
        </div>
      </Section>

      <Section title="Profile">
        <ProfileView
          email="sumonta@example.com"
          profile={sampleProfile}
          report={{ status: 'synced', pending: samplePending, failed: 0 }}
          showImport={false}
          syncBusy={false}
          signingOut={false}
          signOutError={showSignOutError ? SIGN_OUT_FAILED : null}
          onUnitChange={(unit: UnitSystem) => {
            setSampleProfile((current) => ({ ...current, unit_system: unit }))
          }}
          onMutedChange={(muted) => {
            setSampleProfile((current) => ({ ...current, rest_sound_muted: muted }))
          }}
          onSaveTarget={(patch) => {
            setSampleProfile((current) => ({ ...current, ...patch }))
            return Promise.resolve()
          }}
          onSyncNow={() => {
            setSamplePending(0)
          }}
          onSignOut={() => {
            setSampleLost(samplePending === 0 ? null : samplePending)
          }}
          lostOnSignOut={sampleLost}
          onConfirmSignOut={() => {
            setSampleLost(null)
          }}
          onCancelSignOut={() => {
            setSampleLost(null)
          }}
          exerciseSource={manageSource}
          testId="profile-grid-sample"
        />
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <SecondaryButton
            onClick={() => {
              setSamplePending(samplePending === 0 ? 2 : 0)
            }}
          >
            {samplePending === 0 ? 'Show two pending writes' : 'Clear the pending writes'}
          </SecondaryButton>
          <SecondaryButton
            onClick={() => {
              setShowSignOutError(!showSignOutError)
            }}
          >
            {showSignOutError ? 'Hide the sign-out error' : 'Show the sign-out error'}
          </SecondaryButton>
        </div>
        <h3 className="text-text mt-6 text-base font-bold">Sync card, offline and syncing</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <SyncCard
            report={{ status: 'offline', pending: 3, failed: 0 }}
            busy={false}
            onSyncNow={() => undefined}
          />
          <SyncCard
            report={{ status: 'syncing', pending: 1, failed: 0 }}
            busy={false}
            onSyncNow={() => undefined}
          />
        </div>
        <h3 className="text-text mt-6 text-base font-bold">
          Sync card, a write the server refused
        </h3>
        <div
          data-testid="sync-card-refused"
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
        >
          <SyncCard
            report={{ status: 'synced', pending: 0, failed: 1 }}
            busy={false}
            onSyncNow={() => undefined}
            deadLetters={[SAMPLE_DEAD_LETTER]}
          />
        </div>
        <h3 className="text-text mt-6 text-base font-bold">With the Phase 2 flag on</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <DataCard />
        </div>
      </Section>

      <Section title="Import review">
        <div data-testid="import-review-sample">
          <ImportReview
            fileName="gym-sheet.csv"
            text={SAMPLE_IMPORT_SHEET}
            initialYear={2026}
            status={<StatusChip status="synced" announce={false} />}
            source={importSource}
            onImported={ignoreImport}
          />
        </div>
        <h3 className="text-text mt-6 text-base font-bold">A date already logged</h3>
        <Card className="mt-4 max-w-[420px]" data-testid="import-conflict-sample">
          <ImportConflict
            label="Row 16, 13 September"
            choice={sampleChoice}
            onChoose={setSampleChoice}
          />
        </Card>
        <h3 className="text-text mt-6 text-base font-bold">The confirm sheet</h3>
        <div className="mt-4 max-w-[420px]">
          <SecondaryButton
            onClick={() => {
              setSampleConfirmOpen(true)
            }}
          >
            Open the import confirm sheet
          </SecondaryButton>
        </div>
        <ImportConfirmSheet
          open={sampleConfirmOpen}
          counts={SAMPLE_IMPORT_COUNTS}
          busy={false}
          error={null}
          onConfirm={() => {
            setSampleConfirmOpen(false)
          }}
          onCancel={() => {
            setSampleConfirmOpen(false)
          }}
        />
        <h3 className="text-text mt-6 text-base font-bold">The result on the dashboard</h3>
        <div className="mt-4" data-testid="import-notice-sample">
          <ImportNoticeView outcome={SAMPLE_IMPORT_COUNTS} />
        </div>
      </Section>

      <Section title="Status chips">
        <Card className="flex flex-wrap items-center gap-3" data-testid="status-chips">
          <StatusChip status="synced" />
          <StatusChip status="syncing" />
          <StatusChip status="offline" />
          <StatusChip status="pending" />
        </Card>
      </Section>

      <Section title="Segmented tabs">
        <Card className="flex flex-col gap-3">
          <SegmentedTabs
            label="Range"
            options={RANGES}
            value={range}
            onValueChange={(next) => {
              setRange(next)
            }}
          />
          <p className="text-muted text-xs">{`Selected: ${range}`}</p>
        </Card>
      </Section>

      <Section title="Fields">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card className="flex flex-col gap-4" data-testid="number-sample">
            <NumberField label="Weight" unit="kg" placeholder="82.5" inputMode="decimal" />
            <NumberField label="Reps" inputMode="numeric" placeholder="8" />
            <NumberField
              label="Steps"
              error={showFieldError ? 'Enter a whole number' : undefined}
              defaultValue="eight"
            />
            <SecondaryButton
              onClick={() => {
                setShowFieldError(!showFieldError)
              }}
            >
              {showFieldError ? 'Hide the error state' : 'Show the error state'}
            </SecondaryButton>
          </Card>
          <Card
            className="flex flex-col gap-4"
            data-testid="duration-sample"
            data-ready={hydrated ? 'true' : 'false'}
          >
            <DurationField
              label="Gym time"
              value={durationText}
              onChange={(event) => {
                setDurationText(event.target.value)
              }}
            />
            <p className="text-muted text-xs">{`Stored seconds: ${storedSeconds === null ? 'none' : String(storedSeconds)}`}</p>
          </Card>
          <Card className="flex flex-col gap-2" data-testid="nudge-sample">
            <NumberField
              label="Weight (kg)"
              inputMode="decimal"
              value={nudgeWeight.toFixed(2)}
              onChange={(event) => {
                setNudgeWeight(Number(event.target.value) || 0)
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton
                onClick={() => {
                  setNudgeWeight(nextWeight(nudgeWeight, -1))
                }}
              >
                −0.05 <span className="sr-only">kg, decrease the weight</span>
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  setNudgeWeight(nextWeight(nudgeWeight, 1))
                }}
              >
                +0.05 <span className="sr-only">kg, increase the weight</span>
              </SecondaryButton>
            </div>
            <p className="text-muted text-xs">
              The weight nudge pair from the daily log. One step is 0.05 kg, and it never crosses
              the schema floor or ceiling.
            </p>
          </Card>
        </div>
      </Section>

      <Section title="Sign in">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card className="flex flex-col items-center gap-2 text-center">
            <BrandMark />
            <MicroLabel>Brand mark</MicroLabel>
            <p className="text-muted text-xs">64 px, hero radius, accent fill, accent ink.</p>
          </Card>
          <Card className="flex flex-col gap-4">
            <EmailField label="Email" placeholder="you@example.com" />
            <PasswordField label="Password" placeholder="Your password" />
            <EmailField
              label="Email, rejected"
              defaultValue="not-an-email"
              error={showEmailError ? 'Enter an email address like you@example.com.' : undefined}
            />
            <SecondaryButton
              onClick={() => {
                setShowEmailError(!showEmailError)
              }}
            >
              {showEmailError ? 'Hide the email error' : 'Show the email error'}
            </SecondaryButton>
          </Card>
        </div>
      </Section>

      <Section title="Buttons and the sheet">
        <Card className="flex flex-col gap-3 md:flex-row">
          <PrimaryButton
            onClick={() => {
              setOpen(true)
            }}
          >
            Open the sheet
          </PrimaryButton>
          <SecondaryButton>Secondary</SecondaryButton>
          <SecondaryButton tone="danger">Destructive</SecondaryButton>
        </Card>
        <SheetModal
          open={open}
          title="Log a set"
          onClose={() => {
            setOpen(false)
          }}
        >
          <div className="flex flex-col gap-4">
            <NumberField label="Weight" unit="kg" inputMode="decimal" />
            <PrimaryButton
              onClick={() => {
                setOpen(false)
              }}
            >
              Save
            </PrimaryButton>
          </div>
        </SheetModal>
      </Section>

      <Section title="Exercise picker">
        <Card className="flex flex-col gap-3" data-testid="picker-sample">
          <PrimaryButton
            onClick={() => {
              setPickerOpen(true)
            }}
          >
            Open the exercise picker
          </PrimaryButton>
          <p className="text-muted text-xs">{`Picked: ${picked ?? 'none'}`}</p>
        </Card>
        <ExercisePicker
          open={pickerOpen}
          onClose={() => {
            setPickerOpen(false)
          }}
          onPick={(exercise) => {
            setPicked(exercise.name)
          }}
          now={() => SAMPLE_PICKER_NOW}
          source={pickerSource}
        />
      </Section>

      <Section title="Live workout">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="live-sample">
          <HeroCard label="Elapsed" aria-label="Sample session" className="md:col-span-2">
            <SessionTimer
              startedAt={SAMPLE_SESSION_START}
              now={sampleSessionNow}
              aria-label="Sample elapsed time"
              className="mt-2.5 mb-1.5 text-[48px] leading-none font-extrabold tracking-[-2.4px]"
            />
            <p className="text-[13px] font-semibold opacity-80">
              Volume 2,020 kg · 3 sets · 1 exercise
            </p>
          </HeroCard>
          <ExerciseCard
            exercise={{ name: 'Bench Press', muscle_group: 'chest' }}
            sets={SAMPLE_LIVE_SETS}
            records={SAMPLE_LIVE_RECORDS}
            unit="metric"
            source={SAMPLE_LIVE_SETS[2]}
            sourceKey="sample"
            lastTime="Last time 72.5 kg × 8 · estimated 1RM 92 kg"
            onAddSet={() => undefined}
            onEditSet={(set, position) => {
              setSampleEditing({ set, position, exerciseName: 'Bench Press' })
            }}
            onDeleteSet={(_set, position) => {
              setSampleToast({
                key: String(Date.now()),
                message: `Set ${String(position)} deleted.`,
              })
            }}
          />
          {sampleRestSkipped ? (
            <SecondaryButton
              onClick={() => {
                setSampleRestSkipped(false)
                setSampleRestTaps(0)
              }}
            >
              Show the rest timer sample
            </SecondaryButton>
          ) : (
            <RestTimerCard
              exerciseName="Bench Press"
              completedAt={SAMPLE_REST_COMPLETED_AT}
              restSeconds={90}
              savedSeconds={sampleRestSeconds}
              extraTaps={sampleRestTaps}
              now={sampleSessionNow}
              onZero={() => undefined}
              onSkip={() => {
                setSampleRestSkipped(true)
              }}
              onAddThirty={() => {
                setSampleRestTaps((taps) => taps + 1)
              }}
              onChange={() => {
                setSampleChangingRest(true)
              }}
            />
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="gym-offer-sample">
          {sampleOfferUsed ? (
            <SecondaryButton
              onClick={() => {
                setSampleOfferUsed(false)
              }}
            >
              Show the gym time offer sample
            </SecondaryButton>
          ) : (
            <GymTimeOfferCard
              offer={SAMPLE_GYM_OFFER}
              dateLabel="Sun 20 Sep"
              isToday
              onUse={() => {
                setSampleOfferUsed(true)
              }}
            />
          )}
          <SecondaryButton
            onClick={() => {
              setSampleOfferOpen(true)
            }}
          >
            Open the finish sheet
          </SecondaryButton>
        </div>
        <GymTimeSheet
          offer={sampleOfferOpen ? SAMPLE_GYM_OFFER : null}
          dateLabel="Sun 20 Sep"
          summary="Sun 20 Sep · 17:30 to 18:42 · 11 sets · 4,820 kg"
          onUse={() => {
            setSampleOfferOpen(false)
          }}
          onKeep={() => {
            setSampleOfferOpen(false)
          }}
        />
        <RestTimeSheet
          changing={
            sampleChangingRest
              ? {
                  exerciseId: SAMPLE_REST_EXERCISE_ID,
                  exerciseName: 'Bench Press',
                  seconds: sampleRestSeconds,
                }
              : null
          }
          onSave={(seconds) => {
            setSampleRestSeconds(seconds)
            setSampleChangingRest(false)
          }}
          onClose={() => {
            setSampleChangingRest(false)
          }}
        />
        <EditSetSheet
          editing={sampleEditing}
          unit="metric"
          onSave={() => {
            setSampleEditing(null)
          }}
          onDelete={() => {
            if (sampleEditing !== null) {
              setSampleToast({
                key: String(Date.now()),
                message: `Set ${String(sampleEditing.position)} deleted.`,
              })
            }
            setSampleEditing(null)
          }}
          onClose={() => {
            setSampleEditing(null)
          }}
        />
        <UndoToast
          toast={sampleToast}
          onUndo={() => {
            setSampleToast(null)
          }}
          onDismiss={() => {
            setSampleToast(null)
          }}
        />
      </Section>
    </AppShell>
  )
}
