'use client'

import { usePathname } from 'next/navigation'

import { isCurrentPath, NAV_ACTION, NAV_DESTINATIONS } from '../lib/nav'

import { AppShell } from './ui/AppShell'
import { FocusModeProvider, useFocusModeOn } from './ui/FocusMode'

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

  const items = NAV_DESTINATIONS.map((item) => ({
    href: item.href,
    label: item.label,
    glyph: item.glyph,
    current: isCurrentPath(pathname, item.href),
  }))

  const action = { ...NAV_ACTION, current: isCurrentPath(pathname, NAV_ACTION.href) }

  return (
    <AppShell
      items={items}
      action={action}
      mode={focus ? 'focus' : 'default'}
      transitionKey={pathname}
    >
      {children}
    </AppShell>
  )
}
