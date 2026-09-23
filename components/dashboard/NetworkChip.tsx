'use client'

import { useEffect, useState } from 'react'

import { StatusChip } from '../ui/StatusChip'

export function NetworkChip({ className }: { className?: string }) {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const read = (): void => {
      setOnline(globalThis.navigator.onLine)
    }

    read()
    window.addEventListener('online', read)
    window.addEventListener('offline', read)

    return () => {
      window.removeEventListener('online', read)
      window.removeEventListener('offline', read)
    }
  }, [])

  return online ? null : <StatusChip status="offline" className={className} />
}
