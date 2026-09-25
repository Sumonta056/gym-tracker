import { cloneElement, isValidElement } from 'react'

import type { ReactElement, ReactNode } from 'react'

export const CHART_SIZE = { width: 320, height: 160 }

function FixedContainer({ children }: { children: ReactNode }) {
  if (!isValidElement(children)) {
    return null
  }

  return (
    <div data-testid="chart-container" style={CHART_SIZE}>
      {cloneElement(children as ReactElement<{ width: number; height: number }>, CHART_SIZE)}
    </div>
  )
}

export function withFixedContainer<Module extends object>(original: Module): Module {
  return { ...original, ResponsiveContainer: FixedContainer }
}

export function svgTexts(container: Element, selector: string): string[] {
  return Array.from(container.querySelectorAll(selector)).map((node) => node.textContent)
}

export const AXIS_TICKS = '.recharts-cartesian-axis-tick-value[orientation="bottom"]'

export const RANGE_TICKS = '.recharts-cartesian-axis-tick-value[orientation="left"]'

export const VALUE_LABELS = '.recharts-label-list .recharts-label'

export const REFERENCE_LABELS = '.reference-label'

export function barFills(container: Element): (string | null)[] {
  return Array.from(container.querySelectorAll('.recharts-bar-rectangle path')).map((node) =>
    node.getAttribute('fill'),
  )
}
