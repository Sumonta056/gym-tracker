import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'

import type { ReactNode } from 'react'

export type LegendItem = {
  name: string
  dot: string
}

export type ChartCardProps = {
  title: string
  summary?: string
  empty: boolean
  emptyText: string
  label: string
  legend?: LegendItem[]
  footer?: ReactNode
  sparse?: ReactNode
  className?: string
  children?: ReactNode
}

export const SPARSE_HINT = 'Log one more day to see a trend.'

export type SparsePart = {
  value: string
  unit: string
}

export function SparseValue({ parts }: { parts: SparsePart[] }) {
  return (
    <>
      {parts.map((part, index) => (
        <span key={part.unit}>
          {index === 0 ? null : ' · '}
          {part.value}
          <span className="text-muted text-sm font-semibold tracking-normal">{` ${part.unit}`}</span>
        </span>
      ))}
    </>
  )
}

export function ChartCard({
  title,
  summary,
  empty,
  emptyText,
  label,
  legend,
  footer,
  sparse,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2>
          <MicroLabel>{title}</MicroLabel>
        </h2>
        {empty || summary === undefined ? null : (
          <p className="text-muted text-right text-[13px]">{summary}</p>
        )}
      </div>

      {empty ? <p className="text-muted text-sm">{emptyText}</p> : null}

      {!empty && sparse !== undefined ? (
        <div>
          <p className="text-text text-[25px] leading-tight font-bold tracking-[-0.9px]">
            {sparse}
          </p>
          <p className="text-muted mt-1 text-[13px]">{SPARSE_HINT}</p>
        </div>
      ) : null}

      {empty || sparse !== undefined ? null : (
        <>
          <div role="img" aria-label={label} className="w-full min-w-0 overflow-hidden">
            {children}
          </div>
          {legend === undefined ? null : (
            <ul className="flex flex-wrap gap-3">
              {legend.map((item) => (
                <li key={item.name} className="text-muted flex items-center gap-1.5 text-xs">
                  <span
                    aria-hidden="true"
                    className={cn('size-1.5 shrink-0 rounded-full', item.dot)}
                  />
                  {item.name}
                </li>
              ))}
            </ul>
          )}
          {footer}
        </>
      )}
    </Card>
  )
}
