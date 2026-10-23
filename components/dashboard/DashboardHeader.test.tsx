import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DashboardHeader, microLabel, openDay } from './DashboardHeader'

const TODAY = '2026-09-13'
const PAST = '2026-09-10'

function renderHeader(date = TODAY) {
  const push = vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
  render(<DashboardHeader date={date} today={TODAY} />)
  return push
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DashboardHeader', () => {
  it('names the day and the date as the page heading, marked as today', () => {
    renderHeader()
    expect(screen.getByText('Today · Sunday')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '13 September' })).toBeInTheDocument()
  })

  it('names a past day by its weekday alone', () => {
    renderHeader(PAST)
    expect(screen.getByText('Thursday')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '10 September' })).toBeInTheDocument()
  })

  it('holds the three day controls in one labelled group', () => {
    renderHeader(PAST)
    const group = screen.getByRole('group', { name: 'Choose the day' })
    expect(group).toContainElement(screen.getByRole('button', { name: 'Previous day, Wed 9 Sep' }))
    expect(group).toContainElement(screen.getByLabelText('Day'))
    expect(group).toContainElement(screen.getByRole('button', { name: 'Next day, Fri 11 Sep' }))
  })

  it('types every button and gives each a 44 px target', () => {
    renderHeader(PAST)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toHaveClass('w-11', 'h-[52px]')
    }
  })

  it('disables next on today and caps the picker at today', () => {
    renderHeader()
    expect(screen.getByRole('button', { name: 'Next day, Mon 14 Sep' })).toBeDisabled()
    expect(screen.getByLabelText('Day')).toHaveAttribute('max', TODAY)
    expect(screen.getByLabelText('Day')).toHaveValue(TODAY)
  })

  it('enables next on a past day', () => {
    renderHeader(PAST)
    expect(screen.getByRole('button', { name: 'Next day, Fri 11 Sep' })).toBeEnabled()
  })

  it('pushes the previous day into the address', async () => {
    const push = renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Previous day, Sat 12 Sep' }))
    expect(push).toHaveBeenCalledWith(null, '', '/?date=2026-09-12')
  })

  it('pushes the root when next lands on today, and moves focus to the picker', async () => {
    const push = renderHeader('2026-09-12')
    await userEvent.click(screen.getByRole('button', { name: 'Next day, Sun 13 Sep' }))
    expect(push).toHaveBeenCalledWith(null, '', '/')
    expect(screen.getByLabelText('Day')).toHaveFocus()
  })

  it('jumps to the day picked in the date input', () => {
    const push = renderHeader()
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: PAST } })
    expect(push).toHaveBeenCalledWith(null, '', `/?date=${PAST}`)
  })

  it('shows today for a picked day after today and leaves the address alone', () => {
    const push = renderHeader()
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-09-20' } })
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Day')).toHaveValue(TODAY)
  })

  it('keeps the shown day for an empty or partial value', () => {
    const push = renderHeader(PAST)
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '' } })
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Day')).toHaveValue(PAST)
  })

  it('waits for Enter or blur while the day is typed', async () => {
    const push = renderHeader()
    const input = screen.getByLabelText('Day')
    input.focus()
    await userEvent.keyboard('{ArrowDown>}')
    fireEvent.change(input, { target: { value: '2026-09-12' } })
    expect(push).not.toHaveBeenCalled()
    await userEvent.keyboard('{/ArrowDown}')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith(null, '', '/?date=2026-09-12')
  })

  it('commits a typed day on blur', async () => {
    const push = renderHeader()
    const input = screen.getByLabelText('Day')
    input.focus()
    await userEvent.keyboard('{1>}')
    fireEvent.change(input, { target: { value: '2026-09-11' } })
    expect(push).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(push).toHaveBeenCalledWith(null, '', '/?date=2026-09-11')
  })

  it('resets the picker when the shown day changes from outside', () => {
    vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
    const view = render(<DashboardHeader date={TODAY} today={TODAY} />)
    view.rerender(<DashboardHeader date={PAST} today={TODAY} />)
    expect(screen.getByLabelText('Day')).toHaveValue(PAST)
    expect(screen.getByText('Thursday')).toBeInTheDocument()
  })

  it('links the avatar to the profile with a label', () => {
    renderHeader()
    const avatar = screen.getByRole('link', { name: 'Profile' })
    expect(avatar).toHaveAttribute('href', '/profile')
  })

  it('shows the sync chip beside the avatar', () => {
    renderHeader()
    expect(screen.getByRole('status')).toHaveTextContent('Synced')
  })

  it('gives the avatar a 44 px target', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveClass('size-11')
  })
})

describe('microLabel', () => {
  it('prefixes today', () => {
    expect(microLabel(TODAY, TODAY)).toBe('Today · Sunday')
  })

  it('names the weekday of another day', () => {
    expect(microLabel(PAST, TODAY)).toBe('Thursday')
  })
})

describe('openDay', () => {
  it('pushes the path into the history', () => {
    const push = vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
    openDay('/?date=2026-09-10')
    expect(push).toHaveBeenCalledWith(null, '', '/?date=2026-09-10')
  })
})

describe('DashboardHeader avatar', () => {
  it('puts the avatar right-most in its header', () => {
    renderHeader()
    const header = screen.getByRole('banner')
    const last = header.querySelector('a:last-of-type')
    expect(last).toHaveAccessibleName('Profile')
    expect(header.lastElementChild?.lastElementChild).toBe(last)
  })
})
