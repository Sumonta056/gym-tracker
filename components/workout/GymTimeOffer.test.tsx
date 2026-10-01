import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  acceptLabel,
  FINISHED_TITLE,
  GymTimeOfferCard,
  GymTimeSheet,
  keepLabel,
  OFFER_REGION,
} from './GymTimeOffer'

import type { GymTimeOffer } from '../../lib/workout/gymTime'

const OFFER: GymTimeOffer = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  entryDate: '2026-09-20',
  sessionSeconds: 4325,
  loggedSeconds: 3900,
}

const FRESH: GymTimeOffer = { ...OFFER, loggedSeconds: null }

function renderSheet(props: Partial<Parameters<typeof GymTimeSheet>[0]> = {}) {
  const onUse = vi.fn()
  const onKeep = vi.fn()
  render(
    <GymTimeSheet
      offer={OFFER}
      dateLabel="Sun 20 Sep"
      summary="Sun 20 Sep · 17:30 to 18:42 · 11 sets · 4,820 kg"
      onUse={onUse}
      onKeep={onKeep}
      {...props}
    />,
  )
  return { onUse, onKeep }
}

describe('acceptLabel and keepLabel', () => {
  it('names the session length on the accept button', () => {
    expect(acceptLabel(OFFER)).toBe('Use 1:12:05 for gym time')
  })

  it('names the logged value on the keep button', () => {
    expect(keepLabel(OFFER)).toBe('Keep 1:05:00')
  })

  it('reads Not now when the log holds no gym time', () => {
    expect(keepLabel(FRESH)).toBe('Not now')
  })
})

describe('GymTimeSheet', () => {
  it('renders nothing with no offer', () => {
    renderSheet({ offer: null })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the length, the summary and both values', () => {
    renderSheet()
    const sheet = screen.getByRole('dialog', { name: FINISHED_TITLE })

    expect(sheet).toHaveTextContent('Sun 20 Sep · 17:30 to 18:42 · 11 sets · 4,820 kg')
    expect(within(sheet).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Gym time for Sun 20 Sep',
    )
    expect(within(sheet).getByText('In your log').nextSibling).toHaveTextContent('1:05:00')
    expect(within(sheet).getByText('This session').nextSibling).toHaveTextContent('1:12:05')
    expect(sheet).toHaveTextContent('Nothing changes until you pick.')
  })

  it('asks to save when the log holds no gym time', () => {
    renderSheet({ offer: FRESH })
    const sheet = screen.getByRole('dialog', { name: FINISHED_TITLE })

    expect(sheet).toHaveTextContent('Save 1:12:05 as gym time for Sun 20 Sep?')
    expect(within(sheet).queryByText('In your log')).toBeNull()
    expect(within(sheet).getByRole('button', { name: 'Not now' })).toBeVisible()
  })

  it('calls onUse from the accept button', async () => {
    const { onUse, onKeep } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Use 1:12:05 for gym time' }))

    expect(onUse).toHaveBeenCalledTimes(1)
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('calls onKeep from the keep button and from the close button', async () => {
    const { onKeep } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Keep 1:05:00' }))
    await userEvent.click(screen.getByRole('button', { name: `Close ${FINISHED_TITLE}` }))

    expect(onKeep).toHaveBeenCalledTimes(2)
  })

  it('disables both choices while busy and shows the error', () => {
    renderSheet({ busy: true, error: 'disk full' })

    expect(screen.getByRole('button', { name: 'Use 1:12:05 for gym time' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Keep 1:05:00' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('disk full')
  })
})

describe('GymTimeOfferCard', () => {
  it('names the date and both values for another day', () => {
    render(
      <GymTimeOfferCard offer={OFFER} dateLabel="Sun 20 Sep" isToday={false} onUse={vi.fn()} />,
    )

    expect(screen.getByRole('region', { name: OFFER_REGION })).toHaveTextContent(
      'The session on Sun 20 Sep was 1:12:05. Your log says 1:05:00. Use the session for gym time?',
    )
  })

  it('says today for today', () => {
    render(<GymTimeOfferCard offer={FRESH} dateLabel="Sun 20 Sep" isToday onUse={vi.fn()} />)

    expect(screen.getByRole('region', { name: OFFER_REGION })).toHaveTextContent(
      "Today's session was 1:12:05. Your log has no gym time. Use the session for gym time?",
    )
  })

  it('calls onUse from a button that names the value', async () => {
    const onUse = vi.fn()
    render(<GymTimeOfferCard offer={OFFER} dateLabel="Sun 20 Sep" isToday onUse={onUse} />)

    const use = screen.getByRole('button', { name: 'Use 1:12:05 for gym time' })
    expect(use).toHaveAttribute('type', 'button')
    await userEvent.click(use)

    expect(onUse).toHaveBeenCalledTimes(1)
  })

  it('disables Use while busy', () => {
    render(<GymTimeOfferCard offer={OFFER} dateLabel="Sun 20 Sep" isToday busy onUse={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Use 1:12:05 for gym time' })).toBeDisabled()
  })
})
