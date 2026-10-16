import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { resolveLayout, STATS_CARD_IDS } from './statsCards'
import { StatsLayoutEditor } from './StatsLayoutEditor'

function Harness() {
  const [layout, setLayout] = useState(resolveLayout(null))
  return <StatsLayoutEditor layout={layout} onChange={setLayout} />
}

function order(): (string | undefined)[] {
  return within(screen.getByRole('list', { name: 'Stats cards' }))
    .getAllByRole('listitem')
    .map((row) => row.dataset.cardId)
}

async function tabTo(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  for (let step = 0; step < 80; step += 1) {
    await user.tab()
    if (document.activeElement?.getAttribute('aria-label') === name) {
      return
    }
  }
  throw new Error(`No control named ${name} took the focus`)
}

describe('StatsLayoutEditor', () => {
  it('gives every card a move up, a move down and a show switch', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Move Weight up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Weight down' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Show Weight' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getAllByRole('switch')).toHaveLength(STATS_CARD_IDS.length)
  })

  it('disables up on the first row and down on the last', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Move Weight up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Calories a gym minute down' })).toBeDisabled()
  })

  it('moves a card up twice with the keyboard alone and keeps the focus on it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await tabTo(user, 'Move Steps up')
    await user.keyboard('{Enter}')
    expect(order().slice(0, 3)).toEqual(['weight', 'steps', 'calories'])
    expect(screen.getByRole('button', { name: 'Move Steps up' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(order().slice(0, 3)).toEqual(['steps', 'weight', 'calories'])
    expect(screen.getByRole('button', { name: 'Move Steps down' })).toHaveFocus()
  })

  it('moves a card down and keeps the focus on its down button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Move Weight down' }))
    expect(order().slice(0, 2)).toEqual(['calories', 'weight'])
    expect(screen.getByRole('button', { name: 'Move Weight down' })).toHaveFocus()
  })

  it('shows a hidden card again from its switch', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const show = screen.getByRole('switch', { name: 'Show Steps' })
    await user.click(show)
    await user.click(show)
    expect(show).toHaveAttribute('aria-checked', 'true')
    expect(show.closest('li')).not.toHaveTextContent('Hidden')
  })

  it('hides a card with Space on its switch and says so in text', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await tabTo(user, 'Show Weight')
    await user.keyboard(' ')
    expect(screen.getByRole('switch', { name: 'Show Weight' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('switch', { name: 'Show Weight' }).closest('li')).toHaveTextContent(
      'Hidden',
    )
  })
})
