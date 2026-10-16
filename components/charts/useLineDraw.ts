'use client'

import { createContext, useContext, useLayoutEffect, useState } from 'react'

import { prefersReducedMotion } from '../motion/reducedMotion'

export const LINE_DRAW_MS = 400

export const LABEL_FADE_MS = 160

export const DRAW_CLASS = 'chart-draw'

export const LineDrawContext = createContext(true)

export function useLineDraw(): boolean {
  const allowed = useContext(LineDrawContext)
  const [drawing, setDrawing] = useState(allowed)

  useLayoutEffect(() => {
    if (!allowed || prefersReducedMotion()) {
      setDrawing(false)
      return
    }
    const timer = setTimeout(() => {
      setDrawing(false)
    }, LINE_DRAW_MS + LABEL_FADE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [allowed])

  return drawing
}
