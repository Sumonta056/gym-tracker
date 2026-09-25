'use client'

import { useId } from 'react'

import { cn } from '../ui/cn'
import { SecondaryButton } from '../ui/SecondaryButton'

import { DataCard } from './DataCard'
import { ProfileHeader } from './ProfileHeader'
import { SignOutSheet } from './SignOutSheet'
import { SyncCard } from './SyncCard'
import { TargetsCard } from './TargetsCard'
import { UnitsCard } from './UnitsCard'

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
  testId = 'profile-grid',
}: ProfileViewProps) {
  const unit = profile.unit_system
  const hintId = useId()
  const errorId = useId()
  const unsynced = report.pending + report.failed

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
        {showImport ? <DataCard /> : null}
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
      <SignOutSheet lost={lostOnSignOut} onConfirm={onConfirmSignOut} onCancel={onCancelSignOut} />
    </>
  )
}
