'use client'

import { useEffect } from 'react'

import { reloadPage } from '../../lib/errors/browser'
import { installChunkReload, sessionStore } from '../../lib/errors/chunk'

import { VersionBanner } from './VersionBanner'

export function AppGuards({ reload = reloadPage }: { reload?: () => void }) {
  useEffect(() => installChunkReload(window, sessionStore, reload), [reload])

  return <VersionBanner reload={reload} />
}
