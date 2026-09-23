'use client'

import { useEffect, useRef, useState } from 'react'

import { readSignedInEmail, signOut } from '../../lib/auth/browser'
import {
  clearAll,
  getProfile,
  haltSync,
  pendingWrites,
  resumeSync,
  syncNow,
  updateProfile,
  useSyncStatus,
} from '../../lib/db/repository'
import { csvImportEnabled } from '../../lib/flags'

import { ProfileView } from './ProfileView'

import type { Profile as StoredProfile } from '../../lib/db/dexie'
import type { UnitSystem } from '../../lib/schema/profile'

export const READ_ERROR = 'The profile on this device could not be read.'

export const CLEAR_FAILED = 'This device could not be cleared, so you are still signed in.'

export const UNIT_FAILED = 'The unit could not be saved on this device.'

export const SIGN_IN_PATH = '/sign-in'

export function goToSignIn(): void {
  window.location.replace(SIGN_IN_PATH)
}

export type ProfileProps = {
  redirect?: () => void
}

export function Profile({ redirect = goToSignIn }: ProfileProps) {
  const [profile, setProfile] = useState<StoredProfile | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [unitError, setUnitError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [lostOnSignOut, setLostOnSignOut] = useState<number | null>(null)
  const syncing = useRef(false)
  const leaving = useRef(false)
  const clearing = useRef(false)
  const alive = useRef(true)
  const report = useSyncStatus()

  useEffect(() => {
    let cancelled = false

    void getProfile().then(
      (row) => {
        if (!cancelled) setProfile(row)
      },
      () => {
        if (!cancelled) setReadError(READ_ERROR)
      },
    )
    void readSignedInEmail().then((address) => {
      if (!cancelled) setEmail(address)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    alive.current = true

    return () => {
      alive.current = false

      if (leaving.current && !clearing.current) {
        resumeSync()
      }
    }
  }, [])

  async function saveTarget(patch: Partial<StoredProfile>): Promise<void> {
    if (leaving.current) {
      throw new Error('signing out')
    }

    setProfile(await updateProfile(patch))
  }

  function changeUnit(unit: UnitSystem): void {
    if (leaving.current) return

    void updateProfile({ unit_system: unit }).then(
      (row) => {
        setUnitError(null)
        setProfile(row)
      },
      () => {
        setUnitError(UNIT_FAILED)
      },
    )
  }

  function runSyncNow(): void {
    if (syncing.current) return

    syncing.current = true
    setSyncBusy(true)
    void syncNow().finally(() => {
      syncing.current = false
      setSyncBusy(false)
    })
  }

  function stayed(message: string): void {
    leaving.current = false
    clearing.current = false
    setSigningOut(false)
    setSignOutError(message)
  }

  async function runSignOut(): Promise<void> {
    if (leaving.current) return

    leaving.current = true
    setSigningOut(true)
    setSignOutError(null)

    if (report.status !== 'offline') {
      await syncNow()
    }

    let waiting: number

    try {
      await haltSync()
      waiting = await pendingWrites()
    } catch {
      resumeSync()
      stayed(CLEAR_FAILED)
      return
    }

    if (!alive.current) {
      resumeSync()
      return
    }

    if (waiting > 0) {
      setLostOnSignOut(waiting)
      return
    }

    await finishSignOut()
  }

  function cancelSignOut(): void {
    setLostOnSignOut(null)
    resumeSync()
    leaving.current = false
    setSigningOut(false)
  }

  function confirmSignOut(): void {
    setLostOnSignOut(null)
    void finishSignOut()
  }

  async function finishSignOut(): Promise<void> {
    clearing.current = true

    try {
      await clearAll()
    } catch {
      stayed(CLEAR_FAILED)
      return
    }

    const result = await signOut()

    if (result.status === 'error') {
      resumeSync()
      stayed(result.message)
      return
    }

    redirect()
  }

  if (readError !== null) {
    return (
      <p role="alert" className="text-danger text-sm">
        {readError}
      </p>
    )
  }

  if (profile === null) {
    return (
      <p role="status" className="text-muted text-sm">
        Reading this device…
      </p>
    )
  }

  return (
    <ProfileView
      email={email}
      profile={profile}
      report={report}
      showImport={csvImportEnabled()}
      syncBusy={syncBusy}
      signingOut={signingOut}
      signOutError={signOutError}
      unitError={unitError}
      onUnitChange={changeUnit}
      onSaveTarget={saveTarget}
      onSyncNow={runSyncNow}
      onSignOut={() => {
        void runSignOut()
      }}
      lostOnSignOut={lostOnSignOut}
      onConfirmSignOut={confirmSignOut}
      onCancelSignOut={cancelSignOut}
    />
  )
}
