import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'pending'

type ChipStyle = {
  label: string
  dot: string
}

const CHIP: Record<SyncStatus, ChipStyle> = {
  synced: { label: 'Synced', dot: 'bg-ok' },
  offline: { label: 'Offline', dot: 'bg-warn' },
  syncing: { label: 'Syncing', dot: 'bg-data-cyan' },
  pending: { label: 'Pending', dot: 'bg-muted' },
}

export type StatusChipProps = {
  status: SyncStatus
  announce?: boolean
  className?: string
}

export function StatusChip({ status, announce = true, className }: StatusChipProps) {
  const chip = CHIP[status]

  return (
    <span
      role={announce ? 'status' : undefined}
      className={cn(
        'bg-surface border-border inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', chip.dot)} />
      <MicroLabel className="inline-block">{chip.label}</MicroLabel>
    </span>
  )
}
