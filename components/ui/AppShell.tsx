import Link from 'next/link'

import { PageTransition } from '../motion/PageTransition'

import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

import type { ReactNode } from 'react'

export type AppShellNavItem = {
  href: string
  label: string
  glyph?: string
  current?: boolean
}

export type AppShellAction = {
  href: string
  label: string
  glyph?: string
  current?: boolean
}

export type AppShellProps = {
  items: AppShellNavItem[]
  action?: AppShellAction
  title?: string
  aside?: ReactNode
  transitionKey?: string
  children: ReactNode
  className?: string
}

const PRESS =
  'motion-safe:transition-transform motion-safe:duration-100 motion-safe:active:scale-95'

export function AppShell({
  items,
  action,
  title,
  aside,
  transitionKey,
  children,
  className,
}: AppShellProps) {
  const half = Math.ceil(items.length / 2)
  const leftItems = items.slice(0, half)
  const rightItems = items.slice(half)

  return (
    <div className={cn('bg-ground text-text min-h-dvh w-full lg:flex', className)}>
      <nav
        aria-label="Sidebar"
        className="border-border bg-surface hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:border-r lg:p-4"
      >
        <MicroLabel className="mb-3 px-3">Gym Tracker</MicroLabel>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.current === true ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-bold',
              item.current === true ? 'bg-accent text-accent-ink' : 'text-muted',
            )}
          >
            <Glyph glyph={item.glyph} />
            {item.label}
          </Link>
        ))}
        {action === undefined ? null : (
          <Link
            href={action.href}
            aria-current={action.current === true ? 'page' : undefined}
            className={cn(
              'mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 text-sm font-bold',
              action.current === true
                ? 'bg-accent text-accent-ink border-accent'
                : 'bg-surface-2 text-text border-border',
            )}
          >
            <Glyph glyph={action.glyph} />
            {action.label}
          </Link>
        )}
        {aside}
      </nav>

      <div className="flex w-full min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1100px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+88px)] md:px-7 lg:pb-10">
          {title === undefined ? null : (
            <h1 className="text-text mb-4 text-[23px] leading-tight font-bold tracking-[-0.6px]">
              {title}
            </h1>
          )}
          {transitionKey === undefined ? (
            children
          ) : (
            <PageTransition routeKey={transitionKey}>{children}</PageTransition>
          )}
        </main>
      </div>

      <nav
        aria-label="Bottom navigation"
        className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col items-center gap-1 border-t px-2.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden"
      >
        {leftItems.map((item) => (
          <BottomLink key={item.href} item={item} />
        ))}
        {action === undefined ? null : (
          <Link
            href={action.href}
            aria-current={action.current === true ? 'page' : undefined}
            className={cn(
              'bg-accent text-accent-ink flex min-h-[54px] items-center justify-center rounded-full text-lg font-extrabold',
              PRESS,
              action.current === true ? 'border-accent-ink border-2' : '',
            )}
          >
            <Glyph glyph={action.glyph} />
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

function Glyph({ glyph }: { glyph?: string }) {
  if (glyph === undefined) return null
  return (
    <span aria-hidden="true" className="text-[17px] leading-none font-bold">
      {glyph}
    </span>
  )
}

function BottomLink({ item }: { item: AppShellNavItem }) {
  return (
    <Link
      href={item.href}
      aria-current={item.current === true ? 'page' : undefined}
      className={cn(
        'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[14px] px-1',
        PRESS,
        item.current === true ? 'text-accent' : 'text-muted',
      )}
    >
      <Glyph glyph={item.glyph} />
      <MicroLabel tone="inherit" tracking="tab">
        {item.label}
      </MicroLabel>
    </Link>
  )
}
