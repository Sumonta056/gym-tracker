'use client'

import { StatsCard } from './StatsCard'

import type { StatsCardContext } from './StatsCard'
import type { StatsLayoutItem } from './statsCards'

export const ALL_HIDDEN = 'Every card is hidden. Choose Edit to show one.'

export type StatsGridProps = {
  layout: readonly StatsLayoutItem[]
  context: StatsCardContext
  testId?: string
}

export function StatsGrid({ layout, context, testId = 'stats-grid' }: StatsGridProps) {
  const shown = layout.filter((item) => !item.hidden)

  if (shown.length === 0) {
    return <p className="text-muted mt-4 text-sm">{ALL_HIDDEN}</p>
  }

  return (
    <div data-testid={testId} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      {shown.map((item) => (
        <StatsCard key={item.id} id={item.id} context={context} />
      ))}
    </div>
  )
}
