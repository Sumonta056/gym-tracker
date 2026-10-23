'use client'

import { useEffect, useRef, useState } from 'react'

import { updateProfile } from '../../lib/db/repository'
import { ProfileAvatarLink } from '../profile/ProfileAvatarLink'
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
import type { Ref } from 'react'

export type AnalyticsHeaderProps = {
  label: string | null
  onEdit?: () => void
  onCancel?: () => void
  editing?: boolean
  editDisabled?: boolean
  editRef?: Ref<HTMLButtonElement>
}

export function AnalyticsHeader({
  label,
  onEdit,
  onCancel,
  editing = false,
  editDisabled,
  editRef,
}: AnalyticsHeaderProps) {
  const action = editing ? onCancel : onEdit

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]">Stats</h1>
        {label === null ? null : <p className="text-muted text-[13px]">{label}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SyncChip />
        {action === undefined ? null : (
          <button
            ref={editRef}
            type="button"
            aria-label={editing ? 'Cancel, keep the old layout' : 'Customise cards'}
            disabled={editDisabled}
            onClick={action}
            className="bg-surface-2 border-border text-text flex size-11 items-center justify-center rounded-full border disabled:opacity-50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              {editing ? (
                <path d="M5 5l10 10M15 5L5 15" />
              ) : (
                <>
                  <path d="M3 5h14M3 10h14M3 15h14" />
                  <circle cx="7" cy="5" r="1.9" className="fill-surface-2" />
                  <circle cx="13" cy="10" r="1.9" className="fill-surface-2" />
                  <circle cx="8" cy="15" r="1.9" className="fill-surface-2" />
                </>
              )}
            </svg>
          </button>
        )}
        <ProfileAvatarLink />
      </div>
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

  useEffect(() => {
    if (!editing || saving) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        cancelEditing()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [editing, saving])

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

  function cancelEditing() {
    focusNext.current = 'edit'
    setEditing(false)
    setDraft(null)
    setSaveError(null)
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
      <AnalyticsHeader
        label={state.status === 'ready' ? state.data.label : null}
        onEdit={startEditing}
        onCancel={cancelEditing}
        editing={editing}
        editDisabled={editing ? saving : state.status !== 'ready'}
        editRef={editButton}
      />
      <RangeTabs value={tab} onValueChange={changeTab} />

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
