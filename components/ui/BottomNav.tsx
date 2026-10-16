'use client'

import { useKeyboardOpen } from './useKeyboardOpen'

import type { ComponentPropsWithoutRef } from 'react'

export type BottomNavProps = ComponentPropsWithoutRef<'nav'>

export function BottomNav({ children, ...rest }: BottomNavProps) {
  const keyboardOpen = useKeyboardOpen()

  return (
    <nav hidden={keyboardOpen} data-keyboard={keyboardOpen ? 'open' : undefined} {...rest}>
      {children}
    </nav>
  )
}
