'use client'

import { weightSymbol, weightWord } from '../../lib/format/weight'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { SegmentedTabs } from '../ui/SegmentedTabs'

import type { UnitSystem } from '../../lib/schema/profile'

export const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
]

export type UnitsCardProps = {
  unit: UnitSystem
  onUnitChange: (unit: UnitSystem) => void
  error?: string | null
  className?: string
}

export function unitStatement(unit: UnitSystem): string {
  return `Weight shows in ${weightWord(unit)} (${weightSymbol(unit)}).`
}

export function UnitsCard({ unit, onUnitChange, error = null, className }: UnitsCardProps) {
  return (
    <Card className={className}>
      <MicroLabel as="p">Units</MicroLabel>
      <SegmentedTabs
        label="Unit system"
        options={UNIT_OPTIONS}
        value={unit}
        onValueChange={onUnitChange}
        className="mt-2.5"
      />
      <p className="text-text mt-2.5 text-sm font-semibold" aria-live="polite">
        {unitStatement(unit)}
      </p>
      <p className="text-muted mt-1 text-xs">Display only. Weight is always stored in kilograms.</p>
      {error === null ? null : (
        <p role="alert" className="text-danger mt-2 text-xs">
          {error}
        </p>
      )}
    </Card>
  )
}
