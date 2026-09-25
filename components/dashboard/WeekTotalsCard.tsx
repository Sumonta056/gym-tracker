import { formatDuration } from '../../lib/duration'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'

import { formatCount } from './summary'

import type { WeekTotals } from '../../lib/metrics/weekTotals'

export type WeekTotalsCardProps = {
  totals: WeekTotals
  className?: string
}

export function WeekTotalsCard({ totals, className }: WeekTotalsCardProps) {
  const cells = [
    { label: 'sessions', value: String(totals.sessions) },
    { label: 'gym time', value: formatDuration(totals.gymSeconds, 'short') },
    { label: 'kcal', value: formatCount(totals.calories) },
    { label: 'steps', value: formatCount(totals.steps) },
  ]

  return (
    <Card className={cn('flex flex-col gap-2.5', className)}>
      <h2>
        <MicroLabel>This week</MicroLabel>
      </h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 lg:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="flex min-w-0 flex-col-reverse">
            <dt className="text-muted text-xs">{cell.label}</dt>
            <dd className="text-text text-[19px] leading-tight font-bold tracking-[-0.6px] break-words">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
