import { cn } from './cn'

export type BrandMarkProps = {
  className?: string
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-accent text-accent-ink rounded-hero flex h-16 w-16 items-center justify-center text-[28px] font-extrabold',
        className,
      )}
    >
      GT
    </span>
  )
}
