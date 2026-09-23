'use client'

import { notFound } from 'next/navigation'
import { useState } from 'react'

import { AnalyticsHeader, AnalyticsView, RangeTabs } from '../../components/charts/Analytics'
import { analyse } from '../../components/charts/rangeData'
import { StepsChart } from '../../components/charts/StepsChart'
import { nextWeight } from '../../components/DailyEntryForm'
import { DashboardHeader } from '../../components/dashboard/DashboardHeader'
import { HeartRateZonesCard } from '../../components/dashboard/HeartRateZonesCard'
import { TodayHero } from '../../components/dashboard/TodayHero'
import { WeekTotalsCard } from '../../components/dashboard/WeekTotalsCard'
import { AppShell } from '../../components/ui/AppShell'
import { BrandMark } from '../../components/ui/BrandMark'
import { Card } from '../../components/ui/Card'
import { DurationField } from '../../components/ui/DurationField'
import { EmailField } from '../../components/ui/EmailField'
import { HeroCard } from '../../components/ui/HeroCard'
import { MicroLabel } from '../../components/ui/MicroLabel'
import { NumberField } from '../../components/ui/NumberField'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { SegmentedTabs } from '../../components/ui/SegmentedTabs'
import { SheetModal } from '../../components/ui/SheetModal'
import { StatCard } from '../../components/ui/StatCard'
import { StatusChip } from '../../components/ui/StatusChip'
import { colorTokens, radiusTokens } from '../../lib/design/tokens'
import { formatDuration, parseInput } from '../../lib/duration'

import type { RangeTab } from '../../components/charts/rangeData'
import type { DailyEntry } from '../../lib/db/dexie'
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

function sampleStats(entries: DailyEntry[], tab: RangeTab) {
  return analyse(entries, entries, tab, SAMPLE_STATS_TODAY, SAMPLE_STATS_NOW, SAMPLE_STEP_GOAL)
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
  const [durationText, setDurationText] = useState(formatDuration(4325, 'clock'))
  const [nudgeWeight, setNudgeWeight] = useState(73.4)
  const [open, setOpen] = useState(false)
  const [showFieldError, setShowFieldError] = useState(false)
  const [showEmailError, setShowEmailError] = useState(false)
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
          <TodayHero entry={SAMPLE_DAY} streak={4} />
          <TodayHero entry={undefined} streak={0} name="Today, empty state" />
          <HeartRateZonesCard zones={SAMPLE_ZONES} />
          <WeekTotalsCard totals={SAMPLE_WEEK} className="md:col-span-2 lg:col-span-3" />
        </div>
      </Section>

      <Section title="Analytics">
        <Card className="mb-3">
          <AnalyticsHeader label={stats.label} />
          <RangeTabs value={statsTab} onValueChange={setStatsTab} />
        </Card>
        <AnalyticsView data={stats} />
        <h3 className="text-text mt-6 text-base font-bold">One logged day</h3>
        <AnalyticsView data={oneDay} testId="analytics-grid-one-day" />
        <h3 className="text-text mt-6 text-base font-bold">Nothing logged</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <StepsChart days={[]} tab="week" stepGoal={SAMPLE_STEP_GOAL} />
        </div>
      </Section>

      <Section title="Status chips">
        <Card className="flex flex-wrap items-center gap-3">
          <StatusChip status="synced" />
          <StatusChip status="syncing" />
          <StatusChip status="offline" />
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
          <Card className="flex flex-col gap-4">
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
          <Card className="flex flex-col gap-4">
            <DurationField
              label="Gym time"
              value={durationText}
              onChange={(event) => {
                setDurationText(event.target.value)
              }}
            />
            <p className="text-muted text-xs">{`Stored seconds: ${storedSeconds === null ? 'none' : String(storedSeconds)}`}</p>
          </Card>
          <Card className="flex flex-col gap-2">
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
                aria-label="Decrease the weight by 0.05 kilograms"
                onClick={() => {
                  setNudgeWeight(nextWeight(nudgeWeight, -1))
                }}
              >
                −0.05
              </SecondaryButton>
              <SecondaryButton
                aria-label="Increase the weight by 0.05 kilograms"
                onClick={() => {
                  setNudgeWeight(nextWeight(nudgeWeight, 1))
                }}
              >
                +0.05
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
    </AppShell>
  )
}
