'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

import { colorTokens } from '../../lib/design/tokens'
import { DEFAULT_BALANCE_THRESHOLD } from '../../lib/metrics/muscleBalance'
import { MUSCLE_GROUP_LABEL } from '../workout/MuscleGroupChips'

import { ChartCard } from './ChartCard'

import type { MuscleBalance, MuscleShare } from '../../lib/metrics/muscleBalance'
import type { MuscleGroup } from '../../lib/schema/exercise'

export type MuscleBalanceChartProps = {
  balance: MuscleBalance
  threshold?: number
  className?: string
}

export const GROUP_COLORS: Record<MuscleGroup, { fill: string; dot: string }> = {
  chest: { fill: colorTokens.accent, dot: 'bg-accent' },
  back: { fill: colorTokens['data-cyan'], dot: 'bg-data-cyan' },
  legs: { fill: colorTokens['data-violet'], dot: 'bg-data-violet' },
  arms: { fill: colorTokens['data-pink'], dot: 'bg-data-pink' },
  shoulders: { fill: colorTokens['data-blue'], dot: 'bg-data-blue' },
  core: { fill: colorTokens['data-yellow'], dot: 'bg-data-yellow' },
  cardio: { fill: colorTokens['data-slate'], dot: 'bg-data-slate' },
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length < 2) {
    return parts.join('')
  }

  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`
}

function behind(balance: MuscleBalance): MuscleShare[] {
  return balance.shares.filter((share) => balance.below.includes(share.group))
}

export function balanceLabel(
  balance: MuscleBalance,
  threshold: number = DEFAULT_BALANCE_THRESHOLD,
): string {
  const parts = balance.shares.map(
    (share) => `${MUSCLE_GROUP_LABEL[share.group]} ${String(share.share)} percent`,
  )
  const low = behind(balance).map((share) => MUSCLE_GROUP_LABEL[share.group])
  const base = `Share of this week's volume: ${parts.join(', ')}.`

  if (low.length === 0) {
    return base
  }

  return `${base} ${joinAnd(low)} ${low.length === 1 ? 'is' : 'are'} under ${String(threshold)} percent.`
}

export function warningText(
  balance: MuscleBalance,
  threshold: number = DEFAULT_BALANCE_THRESHOLD,
): string | null {
  const low = behind(balance)

  if (low.length === 0) {
    return null
  }

  const names = joinAnd(low.map((share) => MUSCLE_GROUP_LABEL[share.group]))
  const shares = joinAnd(low.map((share) => `${String(share.share)}%`))

  return `${names} behind: ${shares} of this week's volume, under ${String(threshold)}%.`
}

export function BalanceWarning({ text }: { text: string }) {
  return (
    <p role="note" className="text-warn flex items-start gap-2 text-[13px] font-semibold">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        className="mt-px size-4 shrink-0 fill-none stroke-current stroke-[2.2]"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l10 18H2z" />
        <path d="M12 10v5" />
        <path d="M12 18h.01" />
      </svg>
      <span>{text}</span>
    </p>
  )
}

export function MuscleBalanceChart({
  balance,
  threshold = DEFAULT_BALANCE_THRESHOLD,
  className,
}: MuscleBalanceChartProps) {
  const row = Object.fromEntries(balance.shares.map((share) => [share.group, share.share]))
  const warning = warningText(balance, threshold)

  return (
    <ChartCard
      title="Muscle group balance"
      summary="this week"
      empty={balance.shares.length === 0}
      emptyText="Finish a set with a load this week to see the balance."
      label={balanceLabel(balance, threshold)}
      legend={balance.shares
        .filter((share) => share.share > 0)
        .map((share) => ({
          name: `${MUSCLE_GROUP_LABEL[share.group]} ${String(share.share)}%`,
          dot: GROUP_COLORS[share.group].dot,
        }))}
      footer={warning === null ? undefined : <BalanceWarning text={warning} />}
      className={className}
    >
      <div className="bg-surface-2 overflow-hidden rounded-full">
        <ResponsiveContainer width="100%" height={14}>
          <BarChart
            data={[row]}
            layout="vertical"
            accessibilityLayer={false}
            barCategoryGap={0}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" hide />
            {balance.shares.map((share) => (
              <Bar
                key={share.group}
                dataKey={share.group}
                stackId="balance"
                fill={GROUP_COLORS[share.group].fill}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
