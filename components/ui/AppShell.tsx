import Link from 'next/link'

import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

import type { ReactNode } from 'react'

export type AppShellNavItem = {
  href: string
  label: string
  current?: boolean
}

export type AppShellAction = {
  href: string
  label: string
}

export type AppShellProps = {
  items: AppShellNavItem[]
  action?: AppShellAction
  title?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}

export function AppShell({ items, action, title, aside, children, className }: AppShellProps) {
  const half = Math.ceil(items.length / 2)
  const leftItems = items.slice(0, half)
  const rightItems = items.slice(half)

  return (
    <div className={cn('bg-ground text-text min-h-dvh w-full lg:flex', className)}>
      <nav
        aria-label="Sidebar"
        className="border-border bg-surface hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:border-r lg:p-4"
      >
        <MicroLabel className="mb-3 px-3">Gym Tracker</MicroLabel>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.current === true ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center rounded-full px-3 text-sm font-bold',
              item.current === true ? 'bg-accent text-accent-ink' : 'text-muted',
            )}
          >
            {item.label}
          </Link>
        ))}
        {action === undefined ? null : (
          <Link
            href={action.href}
            className="bg-surface-2 text-text border-border mt-3 flex min-h-11 items-center justify-center rounded-full border px-3 text-sm font-bold"
          >
            {action.label}
          </Link>
        )}
        {aside}
      </nav>

      <div className="flex w-full min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1100px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+88px)] md:px-7 lg:px-8 lg:pb-10">
          {title === undefined ? null : (
            <h1 className="text-text mb-4 text-2xl font-extrabold">{title}</h1>
          )}
          {children}
        </main>
      </div>

      <nav
        aria-label="Bottom navigation"
        className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 flex items-center justify-around gap-1 border-t px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] lg:hidden"
      >
        {leftItems.map((item) => (
          <BottomLink key={item.href} item={item} />
        ))}
        {action === undefined ? null : (
          <Link
            href={action.href}
            className="bg-accent text-accent-ink flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-extrabold"
          >
            <span aria-hidden="true">+</span>
            <span className="sr-only">{action.label}</span>
          </Link>
        )}
        {rightItems.map((item) => (
          <BottomLink key={item.href} item={item} />
        ))}
      </nav>
    </div>
  )
}

function BottomLink({ item }: { item: AppShellNavItem }) {
  return (
    <Link
      href={item.href}
      aria-current={item.current === true ? 'page' : undefined}
      className={cn(
        'flex min-h-11 flex-1 items-center justify-center rounded-full px-2 text-xs font-bold',
        item.current === true ? 'text-accent' : 'text-muted',
      )}
    >
      {item.label}
    </Link>
  )
}
