'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import Link from 'next/link'

import { getProfile } from '../../lib/db/repository'
import { cn } from '../ui/cn'

export function initialOf(name: string | null): string {
  const first = name?.trim().charAt(0) ?? ''

  return first === '' ? '☰' : first.toLocaleUpperCase('en-GB')
}

export function ProfileAvatarLink({ className }: { className?: string }) {
  const profile = useLiveQuery(getProfile)

  return (
    <Link
      href="/profile"
      aria-label="Profile"
      className={cn(
        'bg-surface-2 border-border text-accent flex size-11 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold lg:hidden',
        className,
      )}
    >
      <span aria-hidden="true">{initialOf(profile?.display_name ?? null)}</span>
    </Link>
  )
}
