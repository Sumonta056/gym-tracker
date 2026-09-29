'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { MicroLabel } from '../../../components/ui/MicroLabel'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import {
  getActiveSession,
  SessionAlreadyActive,
  SignedOutOnThisDevice,
  startSession,
} from '../../../lib/db/repository'
import { localDate } from '../../../lib/schema/dailyEntry'

const WORKOUT_PATH = '/workout'

const START_FAILED = 'The session could not be started on this device.'

type Launch = 'reading' | 'idle' | 'active'

function goToWorkout(): void {
  window.location.assign(WORKOUT_PATH)
}

function SessionLauncher() {
  const [launch, setLaunch] = useState<Launch>('reading')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true

    getActiveSession().then(
      (session) => {
        if (live) setLaunch(session === undefined ? 'idle' : 'active')
      },
      () => {
        if (live) setLaunch('idle')
      },
    )

    return () => {
      live = false
    }
  }, [])

  const start = () => {
    if (starting) return

    setStarting(true)
    setError(null)
    startSession(localDate()).then(
      () => {
        goToWorkout()
      },
      (cause: unknown) => {
        if (cause instanceof SessionAlreadyActive) {
          goToWorkout()
          return
        }

        setStarting(false)
        setError(cause instanceof SignedOutOnThisDevice ? cause.message : START_FAILED)
      },
    )
  }

  if (launch === 'reading') {
    return null
  }

  return (
    <div className="mt-5 flex max-w-sm flex-col gap-3">
      {launch === 'active' ? (
        <Link
          href={WORKOUT_PATH}
          className="bg-accent text-accent-ink border-accent rounded-input inline-flex min-h-[54px] w-full items-center justify-center border px-4 text-[15px] font-bold tracking-[-0.2px]"
        >
          Resume
        </Link>
      ) : (
        <PrimaryButton disabled={starting} onClick={start}>
          Start a session
        </PrimaryButton>
      )}
      {error === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

export default function WorkoutsPage() {
  return (
    <>
      <MicroLabel as="p">Gym Tracker</MicroLabel>
      <h1 className="mt-2 text-[23px] leading-tight font-bold tracking-[-0.6px]">Workouts</h1>
      <p className="text-muted mt-3 max-w-prose text-sm leading-relaxed">
        The live workout log arrives in Phase 2. The daily tracker is on the Today screen.
      </p>
      <SessionLauncher />
    </>
  )
}
