import Link from 'next/link'

import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { startedText } from '../workout/SessionTimer'
import { sessionPath } from '../workouts/historyText'

import { workoutLine } from './todayText'

import type { TodayWorkout } from './summary'
import type { UnitSystem } from '../../lib/schema/profile'

export type TodayWorkoutCardProps = {
  workouts: TodayWorkout[]
  unit: UnitSystem
  className?: string
}

export function TodayWorkoutCard({ workouts, unit, className }: TodayWorkoutCardProps) {
  return (
    <Card className={cn('flex flex-col gap-1.5', className)}>
      <h2>
        <MicroLabel>Workout today</MicroLabel>
      </h2>
      <ul>
        {workouts.map(({ session, stats }) => (
          <li key={session.id} className="border-border border-b last:border-b-0">
            <Link
              href={sessionPath(session.id)}
              className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="text-muted shrink-0 text-sm">{startedText(session.started_at)}</span>
              <strong className="text-text min-w-0 text-right text-sm break-words">
                {workoutLine(stats, unit)}
              </strong>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
