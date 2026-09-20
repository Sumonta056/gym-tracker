import { cn } from './cn'

export type SyncStatus = 'synced' | 'offline' | 'syncing'

type ChipStyle = {
  label: string
  dot: string
  text: string
}

const CHIP: Record<SyncStatus, ChipStyle> = {
  synced: { label: 'SYNCED', dot: 'bg-ok', text: 'text-ok' },
  offline: { label: 'OFFLINE', dot: 'bg-warn', text: 'text-warn' },
  syncing: { label: 'SYNCING', dot: 'bg-data-cyan', text: 'text-data-cyan' },
}

export type StatusChipProps = {
  status: SyncStatus
  className?: string
}

export function StatusChip({ status, className }: StatusChipProps) {
  const chip = CHIP[status]

  return (
    <span
      role="status"
      className={cn(
        'bg-surface-2 border-border inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', chip.dot)} />
      <span className={cn('text-[10px] font-bold tracking-[1.5px] uppercase', chip.text)}>
        {chip.label}
      </span>
    </span>
  )
}
