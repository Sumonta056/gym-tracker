'use client'

import { useEffect } from 'react'

import { startSync } from '../../lib/db/repository'

export function SyncRunner() {
  useEffect(() => startSync(), [])

  return null
}
