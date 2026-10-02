import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'
import { barFills } from '../../tests/fixtures/recharts'

import { balanceLabel, GROUP_COLORS, MuscleBalanceChart, warningText } from './MuscleBalanceChart'

import type { MuscleBalance } from '../../lib/metrics/muscleBalance'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const PLATE: MuscleBalance = {
  shares: [
    { group: 'chest', volume: 4000, share: 40 },
    { group: 'back', volume: 3100, share: 31 },
    { group: 'legs', volume: 1200, share: 12 },
    { group: 'arms', volume: 1700, share: 17 },
  ],
  below: ['legs'],
}

function split(low: number): MuscleBalance {
  return {
    shares: [
      { group: 'chest', volume: 100 - low, share: 100 - low },
      { group: 'legs', volume: low, share: low },
    ],
    below: low < 15 ? ['legs'] : [],
  }
}

describe('MuscleBalanceChart', () => {
  it('shows its empty state before any session exists', () => {
    render(<MuscleBalanceChart balance={{ shares: [], below: [] }} />)
    expect(screen.getByText('Finish a set with a load this week to see the balance.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('renders one session of one group as one full bar with no warning', () => {
    const { container } = render(
      <MuscleBalanceChart
        balance={{ shares: [{ group: 'chest', volume: 900, share: 100 }], below: [] }}
      />,
    )
    expect(
      screen.getByRole('img', { name: "Share of this week's volume: Chest 100 percent." }),
    ).toBeInTheDocument()
    expect(screen.getByText('Chest 100%')).toBeVisible()
    expect(barFills(container)).toEqual([colorTokens.accent])
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('stacks one segment per group in the plate colours, with a legend item each', () => {
    const { container } = render(<MuscleBalanceChart balance={PLATE} />)
    expect(barFills(container)).toEqual([
      colorTokens.accent,
      colorTokens['data-cyan'],
      colorTokens['data-violet'],
      colorTokens['data-pink'],
    ])
    for (const name of ['Chest 40%', 'Back 31%', 'Legs 12%', 'Arms 17%']) {
      expect(screen.getByText(name)).toBeVisible()
    }
    expect(screen.getByText('this week')).toBeVisible()
  })

  it('gives each muscle group its own data colour and matching legend dot', () => {
    expect(GROUP_COLORS).toEqual({
      chest: { fill: colorTokens.accent, dot: 'bg-accent' },
      back: { fill: colorTokens['data-cyan'], dot: 'bg-data-cyan' },
      legs: { fill: colorTokens['data-violet'], dot: 'bg-data-violet' },
      arms: { fill: colorTokens['data-pink'], dot: 'bg-data-pink' },
      shoulders: { fill: colorTokens['data-blue'], dot: 'bg-data-blue' },
      core: { fill: colorTokens['data-yellow'], dot: 'bg-data-yellow' },
      cardio: { fill: colorTokens['data-slate'], dot: 'bg-data-slate' },
    })
  })

  it('keeps the warn colour for the warning alone, never a segment', () => {
    const balance: MuscleBalance = {
      shares: [
        { group: 'chest', volume: 30, share: 30 },
        { group: 'back', volume: 20, share: 20 },
        { group: 'legs', volume: 20, share: 20 },
        { group: 'arms', volume: 10, share: 10 },
        { group: 'shoulders', volume: 10, share: 10 },
        { group: 'core', volume: 5, share: 5 },
        { group: 'cardio', volume: 5, share: 5 },
      ],
      below: ['arms', 'shoulders', 'core', 'cardio'],
    }
    const { container } = render(<MuscleBalanceChart balance={balance} />)
    const fills = barFills(container)
    expect(fills).toHaveLength(7)
    expect(new Set(fills).size).toBe(7)
    expect(fills).not.toContain(colorTokens.warn)
    for (const { dot } of Object.values(GROUP_COLORS)) {
      expect(dot).not.toBe('bg-warn')
    }
    expect(screen.getByRole('note')).toHaveClass('text-warn')
  })

  it('states the shares and the group behind in its text alternative', () => {
    render(<MuscleBalanceChart balance={PLATE} />)
    expect(
      screen.getByRole('img', {
        name: "Share of this week's volume: Chest 40 percent, Back 31 percent, Legs 12 percent, Arms 17 percent. Legs is under 15 percent.",
      }),
    ).toBeInTheDocument()
  })

  it('warns in text with a shape when a group sits at 14 percent', () => {
    render(<MuscleBalanceChart balance={split(14)} />)
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent("Legs behind: 14% of this week's volume, under 15%.")
    expect(note).toHaveClass('text-warn')
    expect(note.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('shows no warning when the lowest group sits at 15 percent', () => {
    render(<MuscleBalanceChart balance={split(15)} />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.queryByText(/behind/)).not.toBeInTheDocument()
  })

  it('names every group behind in the one warning', () => {
    const balance: MuscleBalance = {
      shares: [
        { group: 'chest', volume: 78, share: 78 },
        { group: 'legs', volume: 12, share: 12 },
        { group: 'core', volume: 10, share: 10 },
      ],
      below: ['legs', 'core'],
    }
    render(<MuscleBalanceChart balance={balance} />)
    expect(screen.getAllByRole('note')).toHaveLength(1)
    expect(screen.getByRole('note')).toHaveTextContent(
      "Legs and Core behind: 12% and 10% of this week's volume, under 15%.",
    )
    expect(balanceLabel(balance)).toContain('Legs and Core are under 15 percent.')
  })

  it('reads a threshold other than the default', () => {
    expect(warningText({ ...split(18), below: ['legs'] }, 20)).toBe(
      "Legs behind: 18% of this week's volume, under 20%.",
    )
  })

  it('lists three groups behind with commas', () => {
    const balance: MuscleBalance = {
      shares: [
        { group: 'chest', volume: 70, share: 70 },
        { group: 'shoulders', volume: 10, share: 10 },
        { group: 'core', volume: 10, share: 10 },
        { group: 'cardio', volume: 10, share: 10 },
      ],
      below: ['shoulders', 'core', 'cardio'],
    }
    expect(warningText(balance)).toBe(
      "Shoulders, Core and Cardio behind: 10%, 10% and 10% of this week's volume, under 15%.",
    )
  })

  it('keeps a group rounded to 0 percent out of the legend, and still warns about it', () => {
    render(
      <MuscleBalanceChart
        balance={{
          shares: [
            { group: 'chest', volume: 999, share: 100 },
            { group: 'core', volume: 1, share: 0 },
          ],
          below: ['core'],
        }}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('Core 0%')).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Core behind: 0%')
  })

  it('returns no warning text with no group behind', () => {
    expect(warningText(split(30))).toBeNull()
  })
})
