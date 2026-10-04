'use client'

import { useId, useState } from 'react'

import { ImportReview } from '../csv/ImportReview'
import { SyncChipView } from '../sync/SyncChip'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'

import { DataCard } from './DataCard'
import { ManageExercisesSheet, REPOSITORY_MANAGE_SOURCE } from './ManageExercisesSheet'
import { ProfileHeader } from './ProfileHeader'
import { RestSoundCard } from './RestSoundCard'
import { SignOutSheet } from './SignOutSheet'
import { SyncCard } from './SyncCard'
import { TargetsCard } from './TargetsCard'
import { UnitsCard } from './UnitsCard'

import type { ChosenSheet } from './DataCard'
import type { ManageExerciseSource } from './ManageExercisesSheet'
import type { DeadLetter, Profile } from '../../lib/db/dexie'
import type { SyncStatusReport } from '../../lib/db/repository'
import type { UnitSystem } from '../../lib/schema/profile'

function ignore(): void {
  return undefined
}

export function signOutHint(pending: number): string {
  if (pending === 0) {
    return 'Signing out clears every entry on this device.'
  }

  const writes = pending === 1 ? '1 write has' : `${String(pending)} writes have`

  return `${writes} not reached the server yet. Signing out now loses them.`
}

export type ProfileViewProps = {
  email: string | null
  profile: Profile
  report: SyncStatusReport
  showImport: boolean
  syncBusy: boolean
  signingOut: boolean
  signOutError: string | null
  unitError?: string | null
  onUnitChange: (unit: UnitSystem) => void
  onMutedChange?: (muted: boolean) => void
  soundError?: string | null
  onSaveTarget: (patch: Partial<Profile>) => Promise<void>
  onSyncNow: () => void
  onSignOut: () => void
  deadLetters?: DeadLetter[]
  onRetryDeadLetter?: (id: string) => void
  onDiscardDeadLetter?: (id: string) => void
  deadLetterError?: string | null
  lostOnSignOut?: number | null
  onConfirmSignOut?: () => void
  onCancelSignOut?: () => void
  exerciseSource?: ManageExerciseSource
  testId?: string
}

export function ProfileView({
  email,
  profile,
  report,
  showImport,
  syncBusy,
  signingOut,
  signOutError,
  unitError = null,
  onUnitChange,
  onMutedChange = ignore,
  soundError = null,
  onSaveTarget,
  onSyncNow,
  onSignOut,
  deadLetters = [],
  onRetryDeadLetter = ignore,
  onDiscardDeadLetter = ignore,
  deadLetterError = null,
  lostOnSignOut = null,
  onConfirmSignOut = ignore,
  onCancelSignOut = ignore,
  exerciseSource = REPOSITORY_MANAGE_SOURCE,
  testId = 'profile-grid',
}: ProfileViewProps) {
  const [managing, setManaging] = useState(false)
  const [importing, setImporting] = useState<ChosenSheet | null>(null)
  const unit = profile.unit_system
  const hintId = useId()
  const errorId = useId()
  const unsynced = report.pending + report.failed

  if (importing !== null) {
    return (
      <ImportReview
        fileName={importing.fileName}
        text={importing.text}
        initialYear={importing.year}
        focusOnMount
        status={<SyncChipView report={report} className="shrink-0" />}
        onClose={() => {
          setImporting(null)
        }}
      />
    )
  }

  return (
    <>
      <ProfileHeader email={email} report={report} />
      <div
        data-testid={testId}
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      >
        <UnitsCard unit={unit} onUnitChange={onUnitChange} error={unitError} />
        <TargetsCard
          profile={profile}
          unit={unit}
          onSave={onSaveTarget}
          className="md:row-span-2"
        />
        <RestSoundCard
          muted={profile.rest_sound_muted ?? false}
          onMutedChange={onMutedChange}
          error={soundError}
        />
        <Card data-testid="exercises-card">
          <MicroLabel as="p">Exercises</MicroLabel>
          <button
            type="button"
            onClick={() => {
              setManaging(true)
            }}
            className="text-text mt-1.5 flex min-h-11 w-full items-center justify-between gap-3 text-left text-[15px] font-bold"
          >
            Manage exercises
            <span aria-hidden="true" className="text-muted text-lg">
              ›
            </span>
          </button>
        </Card>
        {showImport ? <DataCard onSheet={setImporting} /> : null}
        <SyncCard
          report={report}
          busy={syncBusy}
          onSyncNow={onSyncNow}
          deadLetters={deadLetters}
          onRetry={onRetryDeadLetter}
          onDiscard={onDiscardDeadLetter}
          deadLetterError={deadLetterError}
        />
        <div className="flex flex-col gap-2">
          <SecondaryButton
            tone="danger"
            disabled={signingOut}
            aria-describedby={cn(hintId, signOutError === null ? undefined : errorId)}
            onClick={onSignOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </SecondaryButton>
          <p id={hintId} className={unsynced === 0 ? 'text-muted text-xs' : 'text-warn text-xs'}>
            {signOutHint(unsynced)}
          </p>
          {signOutError === null ? null : (
            <p id={errorId} role="alert" className="text-danger text-xs">
              {signOutError}
            </p>
          )}
        </div>
      </div>
      <ManageExercisesSheet
        open={managing}
        onClose={() => {
          setManaging(false)
        }}
        source={exerciseSource}
      />
      <SignOutSheet lost={lostOnSignOut} onConfirm={onConfirmSignOut} onCancel={onCancelSignOut} />
    </>
  )
}
