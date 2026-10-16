'use client'

import { useEffect, useRef, useState } from 'react'

import { updateProfile } from '../../lib/db/repository'
import { SyncChip } from '../sync/SyncChip'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SegmentedTabs } from '../ui/SegmentedTabs'

import { analyseLifts } from './liftData'
import { RANGE_TABS } from './rangeData'
import { StatsCard } from './StatsCard'
import { cardsInGroup, resolveLayout } from './statsCards'
import { StatsGrid } from './StatsGrid'
import { StatsLayoutEditor } from './StatsLayoutEditor'
import { useAnalytics } from './useAnalytics'
import { useLiftData } from './useLiftData'
import { LineDrawContext } from './useLineDraw'

import type { AnalyticsData, RangeTab } from './rangeData'
import type { StatsCardContext } from './StatsCard'
import type { StatsLayoutItem } from './statsCards'
import type { Profile } from '../../lib/db/dexie'

export type AnalyticsHeaderProps = {
  label: string | null
}

export function AnalyticsHeader({ label }: AnalyticsHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]">Stats</h1>
        {label === null ? null : <p className="text-muted text-[13px]">{label}</p>}
      </div>
      <SyncChip className="shrink-0" />
    </header>
  )
}

export type RangeTabsProps = {
  value: RangeTab
  onValueChange: (value: RangeTab) => void
}

export function RangeTabs({ value, onValueChange }: RangeTabsProps) {
  return (
    <SegmentedTabs
      label="Range"
      options={RANGE_TABS}
      value={value}
      onValueChange={onValueChange}
      className="mt-4"
    />
  )
}

export type AnalyticsViewProps = {
  data: AnalyticsData
  testId?: string
}

export function AnalyticsView({ data, testId = 'analytics-grid' }: AnalyticsViewProps) {
  const context: StatsCardContext = { daily: data, lifts: null, week: null }

  return (
    <div data-testid={testId} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      {cardsInGroup('daily').map((id) => (
        <StatsCard key={id} id={id} context={context} />
      ))}
    </div>
  )
}

export const LAYOUT_SAVE_FAILED = 'The layout could not be saved on this device.'

export type AnalyticsProps = {
  clock?: () => Date
  save?: (patch: Partial<Profile>) => Promise<unknown>
}

export function Analytics({ clock, save = updateProfile }: AnalyticsProps) {
  const [tab, setTab] = useState<RangeTab>('week')
  const state = useAnalytics(tab, clock)
  const lifts = useLiftData()
  const [switched, setSwitched] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<StatsLayoutItem[] | null>(null)
  const [saved, setSaved] = useState<StatsLayoutItem[] | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const editorHeading = useRef<HTMLHeadingElement>(null)
  const focusNext = useRef<'editor' | 'edit' | null>(null)

  useEffect(() => {
    const target = focusNext.current
    focusNext.current = null

    if (target === 'editor') {
      editorHeading.current?.focus()
    } else if (target === 'edit') {
      editButton.current?.focus()
    }
  }, [editing])

  const layout = saved ?? (state.status === 'ready' ? state.layout : resolveLayout(null))

  function changeTab(next: RangeTab) {
    setSwitched(true)
    setTab(next)
  }

  function startEditing() {
    setDraft([...layout])
    setSaveError(null)
    focusNext.current = 'editor'
    setEditing(true)
  }

  async function finishEditing(next: StatsLayoutItem[]) {
    setSaving(true)

    try {
      await save({ stats_layout: next })
      setSaved(next)
      focusNext.current = 'edit'
      setEditing(false)
      setDraft(null)
      setSaveError(null)
    } catch {
      setSaveError(LAYOUT_SAVE_FAILED)
    } finally {
      setSaving(false)
    }
  }

  function context(data: AnalyticsData): StatsCardContext {
    if (lifts.status !== 'ready') {
      return { daily: data, lifts: null, week: null }
    }

    return {
      daily: data,
      lifts: {
        analysis: analyseLifts(
          lifts.source.sessions,
          lifts.source.sets,
          lifts.source.exercises,
          data.tab,
          data.today,
        ),
        unit: data.unitSystem,
        tab: data.tab,
        today: data.today,
      },
      week: {
        source: lifts.source,
        days: data.days,
        today: data.today,
        sessionDates: data.sessionDates,
      },
    }
  }

  return (
    <>
      <AnalyticsHeader label={state.status === 'ready' ? state.data.label : null} />
      <RangeTabs value={tab} onValueChange={changeTab} />

      {editing ? null : (
        <div className="mt-3 flex justify-end">
          <button
            ref={editButton}
            type="button"
            disabled={state.status !== 'ready'}
            onClick={startEditing}
            className="text-text bg-surface-2 border-border inline-flex min-h-11 items-center rounded-full border px-4 text-[13px] font-bold disabled:opacity-50"
          >
            Edit
          </button>
        </div>
      )}

      {editing && draft !== null ? (
        <>
          <StatsLayoutEditor layout={draft} onChange={setDraft} headingRef={editorHeading} />
          {saveError === null ? null : (
            <p role="alert" className="text-danger mt-2 text-sm">
              {saveError}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SecondaryButton
              type="button"
              onClick={() => {
                setDraft(resolveLayout(null))
              }}
            >
              Reset
            </SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={saving}
              onClick={() => {
                void finishEditing(draft)
              }}
            >
              Done
            </PrimaryButton>
          </div>
        </>
      ) : null}

      <LineDrawContext value={!switched}>
        {state.status === 'loading' ? (
          <p role="status" className="text-muted mt-4 text-sm">
            Reading this device…
          </p>
        ) : null}

        {state.status === 'error' ? (
          <p role="alert" className="text-danger mt-4 text-sm">
            {state.message}
          </p>
        ) : null}

        {state.status === 'ready' && !editing ? (
          <StatsGrid layout={layout} context={context(state.data)} />
        ) : null}

        {state.status === 'ready' && lifts.status === 'loading' ? (
          <p role="status" className="text-muted mt-4 text-sm">
            Reading the workouts…
          </p>
        ) : null}

        {lifts.status === 'error' ? (
          <p role="alert" className="text-danger mt-4 text-sm">
            {lifts.message}
          </p>
        ) : null}
      </LineDrawContext>
    </>
  )
}
