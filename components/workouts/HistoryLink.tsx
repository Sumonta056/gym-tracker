'use client'

import type { MouseEvent, ReactNode } from 'react'

export type HistoryLinkProps = { href: string; className?: string; children: ReactNode }

export function followsInPlace(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

export function HistoryLink({ href, className, children }: HistoryLinkProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (followsInPlace(event)) {
          event.preventDefault()
          window.history.pushState(null, '', href)
        }
      }}
    >
      {children}
    </a>
  )
}
