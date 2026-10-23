'use client'

import { usePathname } from 'next/navigation'

import { isCurrentPath, NAV_ACTION, NAV_DESTINATIONS, SIDEBAR_DESTINATIONS } from '../lib/nav'

import { AppShell } from './ui/AppShell'
import { FocusModeProvider, useFocusModeOn } from './ui/FocusMode'

import type { NavDestination } from '../lib/nav'
import type { ReactNode } from 'react'

export function AppNav({ children }: { children: ReactNode }) {
  return (
    <FocusModeProvider>
      <NavShell>{children}</NavShell>
    </FocusModeProvider>
  )
}

function NavShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const focus = useFocusModeOn()

  const withCurrent = (item: NavDestination) => ({
    href: item.href,
    label: item.label,
    glyph: item.glyph,
    current: isCurrentPath(pathname, item.href),
  })
  const items = NAV_DESTINATIONS.map(withCurrent)
  const sidebarItems = SIDEBAR_DESTINATIONS.map(withCurrent)

  const action = { ...NAV_ACTION, current: isCurrentPath(pathname, NAV_ACTION.href) }

  return (
    <AppShell
      items={items}
      sidebarItems={sidebarItems}
      action={action}
      mode={focus ? 'focus' : 'default'}
      transitionKey={pathname}
    >
      {children}
    </AppShell>
  )
}
