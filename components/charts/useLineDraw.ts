'use client'

import { useLayoutEffect, useState } from 'react'

import { prefersReducedMotion } from '../motion/reducedMotion'

export const LINE_DRAW_MS = 400

export const LABEL_FADE_MS = 160

export const DRAW_CLASS = 'chart-draw'

export function useLineDraw(): boolean {
  const [drawing, setDrawing] = useState(true)

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      setDrawing(false)
      return
    }
    const timer = setTimeout(() => {
      setDrawing(false)
    }, LINE_DRAW_MS + LABEL_FADE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [])

  return drawing
}
