import { cn } from '../ui/cn'

export const MIN_BAR_PERCENT = 4

export type VolumeBarProps = { volumeKg: number; maxKg: number; className?: string }

export function volumeShare(volumeKg: number, maxKg: number): number {
  if (maxKg <= 0) {
    return 0
  }

  return Math.min(100, Math.max(0, (volumeKg / maxKg) * 100))
}

export function volumeBarLabel(share: number): string {
  return `${String(Math.round(share))}% of your biggest session`
}

export function VolumeBar({ volumeKg, maxKg, className }: VolumeBarProps) {
  const share = volumeShare(volumeKg, maxKg)

  return (
    <span
      role="img"
      aria-label={volumeBarLabel(share)}
      className={cn('bg-surface-2 block h-1 w-full overflow-hidden rounded-full', className)}
    >
      <span
        data-testid="volume-fill"
        className="bg-data-cyan block h-full rounded-full"
        style={{ width: `${String(Math.max(MIN_BAR_PERCENT, share))}%` }}
      />
    </span>
  )
}
