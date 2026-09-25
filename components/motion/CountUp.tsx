'use client'

import { animate } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { prefersReducedMotion } from './reducedMotion'

export const COUNT_UP_SECONDS = 0.7

export type CountUpProps = {
  value: number
  format: (value: number) => string
}

export function CountUp({ value, format }: CountUpProps) {
  const overlay = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  const target = useRef(value)
  const [counting, setCounting] = useState(false)

  useLayoutEffect(() => {
    if (started.current) {
      return
    }
    started.current = true
    if (!prefersReducedMotion() && value > 0) {
      setCounting(true)
    }
  }, [value])

  useEffect(() => {
    if (!counting) {
      return
    }
    if (value !== target.current) {
      setCounting(false)
      return
    }
    const controls = animate(0, value, {
      duration: COUNT_UP_SECONDS,
      ease: 'easeOut',
      onUpdate: (latest) => {
        overlay.current?.setAttribute('data-count', format(Math.round(latest)))
      },
      onComplete: () => {
        setCounting(false)
      },
    })
    return () => {
      controls.stop()
    }
  }, [counting, value, format])

  return (
    <span className="relative inline-block">
      <span data-testid="count-up-value" className={counting ? 'opacity-0' : undefined}>
        {format(value)}
      </span>
      {counting ? (
        <span
          ref={overlay}
          aria-hidden="true"
          data-testid="count-up-display"
          data-count={format(0)}
          className="absolute inset-0 whitespace-nowrap after:content-[attr(data-count)]"
        />
      ) : null}
    </span>
  )
}
