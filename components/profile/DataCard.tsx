'use client'

import { useId } from 'react'

import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'

export function DataCard({ className }: { className?: string }) {
  const hintId = useId()

  return (
    <Card className={className} data-testid="data-card">
      <MicroLabel as="p">Data</MicroLabel>
      <div className="mt-2.5 grid gap-2.5">
        <SecondaryButton disabled aria-describedby={hintId}>
          Import the Excel CSV
        </SecondaryButton>
        <SecondaryButton disabled aria-describedby={hintId}>
          Export everything as CSV
        </SecondaryButton>
      </div>
      <p id={hintId} className="text-muted mt-2.5 text-xs">
        The CSV import and export arrive in Phase 2.
      </p>
    </Card>
  )
}
