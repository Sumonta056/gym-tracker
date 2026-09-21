'use client'

import { notFound } from 'next/navigation'
import { useState } from 'react'

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
import { formatDuration } from '../../lib/duration'

import type { ReactNode } from 'react'

const NAV = [
  { href: '/', label: 'Today', current: false },
  { href: '/history', label: 'History' },
  { href: '/body', label: 'Body' },
  { href: '/styleguide', label: 'Style guide', current: true },
]

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
  const [seconds, setSeconds] = useState<number | null>(4325)
  const [open, setOpen] = useState(false)
  const [showFieldError, setShowFieldError] = useState(false)
  const [showEmailError, setShowEmailError] = useState(false)

  return (
    <AppShell items={NAV} action={{ href: '/log', label: 'Log a set' }} title="Style guide">
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
              value={seconds}
              onValueChange={(next) => {
                setSeconds(next)
              }}
            />
            <p className="text-muted text-xs">{`Stored seconds: ${seconds === null ? 'none' : String(seconds)}`}</p>
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
