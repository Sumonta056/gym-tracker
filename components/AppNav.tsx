'use client'

import { usePathname } from 'next/navigation'

import { isCurrentPath, NAV_ACTION, NAV_DESTINATIONS } from '../lib/nav'

import { AppShell } from './ui/AppShell'

import type { ReactNode } from 'react'

export function AppNav({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  const items = NAV_DESTINATIONS.map((item) => ({
    href: item.href,
    label: item.label,
    glyph: item.glyph,
    current: isCurrentPath(pathname, item.href),
  }))

  const action = { ...NAV_ACTION, current: isCurrentPath(pathname, NAV_ACTION.href) }

  return (
    <AppShell items={items} action={action} transitionKey={pathname}>
      {children}
    </AppShell>
  )
}
