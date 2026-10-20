import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { getPlan } from '../../lib/plans'

import { PlanCard, PlanThumb } from './PlanCard'

import type { Plan, PlanId } from '../../lib/schema/plan'

function plan(id: PlanId): Plan {
  const found = getPlan(id)
  if (found === undefined) throw new Error(`expected the plan ${id}`)
  return found
}

function renderCard(selected: boolean, onToggle = vi.fn()) {
  render(
    <PlanCard
      plan={plan('chest-triceps')}
      lastDone="2026-10-14"
      today="2026-10-20"
      selected={selected}
      onToggle={onToggle}
    />,
  )
  return screen.getByRole('button', { name: /Chest \+ Triceps/ })
}

describe('PlanCard', () => {
  it('is a toggle button that reads its state', () => {
    expect(renderCard(false)).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a check mark and the accent border when selected', () => {
    const card = renderCard(true)

    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(card).toHaveClass('border-accent')
    expect(screen.getByTestId('plan-mark')).toHaveTextContent('✓')
  })

  it('shows an empty mark when not selected', () => {
    renderCard(false)

    expect(screen.getByTestId('plan-mark')).toHaveTextContent('')
  })

  it('calls onToggle on a tap', async () => {
    const onToggle = vi.fn()
    await userEvent.click(renderCard(false, onToggle))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('names the exercise count and the last day', () => {
    renderCard(false)

    expect(screen.getByText('9 exercises · last done 6 days ago')).toBeInTheDocument()
  })

  it('reads never done for a plan with no session', () => {
    render(
      <PlanCard
        plan={plan('legs')}
        lastDone={undefined}
        today="2026-10-20"
        selected={false}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('3 exercises · never done')).toBeInTheDocument()
  })

  it('labels the muscle map with the plan muscles', () => {
    renderCard(false)

    expect(screen.getByRole('img', { name: /^Main: Chest, Triceps\./ })).toBeInTheDocument()
  })

  it('shows the start image of the first step with an empty alt', () => {
    const { container } = render(
      <PlanCard
        plan={plan('legs')}
        lastDone={undefined}
        today="2026-10-20"
        selected={false}
        onToggle={vi.fn()}
      />,
    )
    const image = container.querySelector('img')

    expect(image).toHaveAttribute('src', '/exercises/squat-start.webp')
    expect(image).toHaveAttribute('alt', '')
  })

  it('keeps the tap target 72 px tall', () => {
    expect(renderCard(false)).toHaveClass('min-h-[72px]')
  })
})

describe('PlanThumb', () => {
  it('keeps its size with no image', () => {
    const { container } = render(<PlanThumb src={undefined} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.firstElementChild).toHaveClass('h-10', 'w-[60px]', 'bg-surface-2')
  })
})
