'use client'

import { motion } from 'motion/react'
import { useRef } from 'react'

import { prefersReducedMotion } from './reducedMotion'

import type { ReactNode } from 'react'

export const PAGE_TRANSITION_SECONDS = 0.18

export const PAGE_ENTER = { opacity: 0, y: 8 }

export const PAGE_REST = { opacity: 1, y: 0 }

export type PageTransitionProps = {
  routeKey: string
  children: ReactNode
}

export function PageTransition({ routeKey, children }: PageTransitionProps) {
  const firstKey = useRef(routeKey)
  const moved = useRef(false)

  if (routeKey !== firstKey.current) {
    moved.current = true
  }

  const enter = moved.current && !prefersReducedMotion()

  return (
    <motion.div
      key={routeKey}
      data-testid="page-transition"
      initial={enter ? PAGE_ENTER : false}
      animate={PAGE_REST}
      transition={{ duration: PAGE_TRANSITION_SECONDS, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
