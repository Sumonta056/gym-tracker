'use client'

import { useSyncExternalStore } from 'react'

import { getVersionState, subscribeVersionState } from '../../lib/db/repository'
import { reloadPage } from '../../lib/errors/browser'

import type { VersionState } from '../../lib/db/repository'

export const VERSION_READY = 'A new version is ready.'

export const VERSION_BLOCKED = 'Close the other Gym Tracker tabs to finish the update.'

function currentOnServer(): VersionState {
  return 'current'
}

export function VersionBannerView({
  state,
  onReload,
}: {
  state: Exclude<VersionState, 'current'>
  onReload: () => void
}) {
  return (
    <div
      role="alert"
      className="bg-surface border-accent rounded-card flex items-center justify-between gap-3 border p-3"
    >
      <p className="text-text text-sm font-bold">
        {state === 'stale' ? VERSION_READY : VERSION_BLOCKED}
      </p>
      {state === 'stale' ? (
        <button
          type="button"
          onClick={onReload}
          className="bg-accent text-accent-ink min-h-11 shrink-0 rounded-full px-4 text-sm font-bold"
        >
          Reload
        </button>
      ) : null}
    </div>
  )
}

export function VersionBanner({ reload = reloadPage }: { reload?: () => void }) {
  const state = useSyncExternalStore(subscribeVersionState, getVersionState, currentOnServer)

  if (state === 'current') {
    return null
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 px-5 pt-[calc(env(safe-area-inset-top)+8px)] md:px-7 lg:left-60">
      <VersionBannerView
        state={state}
        onReload={() => {
          reload()
        }}
      />
    </div>
  )
}
