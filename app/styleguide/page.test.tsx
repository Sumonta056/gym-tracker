import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'

import StyleguidePage from './page'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

describe('the styleguide route guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is not found when the flag is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_STYLEGUIDE', '')
    expect(() => {
      render(<StyleguidePage />)
    }).toThrow('NEXT_NOT_FOUND')
  })
})

describe('the styleguide page', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_STYLEGUIDE', '1')
    render(<StyleguidePage />)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders inside the app shell', () => {
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Bottom navigation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Style guide' })).toBeInTheDocument()
  })

  it('renders a swatch for every colour token', () => {
    for (const [name, value] of Object.entries(colorTokens)) {
      expect(screen.getByText(name)).toBeInTheDocument()
      expect(screen.getAllByText(value).length).toBeGreaterThan(0)
    }
  })

  it('renders every type step', () => {
    for (const step of ['Hero number', 'Stat number', 'Title', 'Body text', 'Small', 'Caption']) {
      expect(screen.getByText(step)).toBeInTheDocument()
    }
  })

  it('renders every primitive section', () => {
    for (const heading of [
      'Colour tokens',
      'Radius tokens',
      'Type scale',
      'Cards',
      'Stat cards',
      'Dashboard',
      'Status chips',
      'Segmented tabs',
      'Fields',
      'Sign in',
      'Buttons and the sheet',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
    }
  })

  it('renders the hero card and the three sync chips', () => {
    expect(screen.getAllByText('Gym time today').length).toBeGreaterThan(0)
    expect(screen.getByText('SYNCED')).toBeInTheDocument()
    expect(screen.getByText('SYNCING')).toBeInTheDocument()
    expect(screen.getByText('OFFLINE')).toBeInTheDocument()
  })

  it('renders the dashboard hero, its empty state, the zone bar and the week totals', () => {
    expect(screen.getByText('4 day streak')).toBeInTheDocument()
    const empty = screen.getByText('Nothing logged yet today.').closest('section')
    expect(empty).not.toBeNull()
    expect(within(empty as HTMLElement).getByRole('link', { name: 'Log the day' })).toHaveAttribute(
      'href',
      '/log',
    )
    expect(screen.getByRole('img', { name: /^Heart rate zones: Warm 8m/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'This week' })).toBeInTheDocument()
  })

  it('shows the duration field already formatted from stored seconds', () => {
    expect(screen.getByLabelText('Gym time')).toHaveValue('1:12:05')
    expect(screen.getByText('Stored seconds: 4325')).toBeInTheDocument()
  })

  it('shows the weight nudge pair from the daily log', async () => {
    const weight = screen.getByLabelText('Weight (kg)')
    expect(weight).toHaveValue('73.40')
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase the weight by 0.05 kilograms' }),
    )
    expect(weight).toHaveValue('73.45')
  })

  it('switches the segmented tabs', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Month' }))
    expect(screen.getByText('Selected: month')).toBeInTheDocument()
  })

  it('opens and closes the sheet', async () => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    expect(screen.getByRole('dialog', { name: 'Log a set' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close Log a set' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stores the seconds the duration field reports', async () => {
    const field = screen.getByLabelText('Gym time')
    await userEvent.clear(field)
    await userEvent.type(field, '72m')
    await userEvent.tab()
    expect(screen.getByText('Stored seconds: 4320')).toBeInTheDocument()
  })

  it('closes the sheet from its save button', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('holds the error state back until it is asked for, so nothing shouts on arrival', () => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Steps')).not.toHaveAttribute('aria-invalid')
  })

  it('shows an errored field tied to its message', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Show the error state' }))
    const steps = screen.getByLabelText('Steps')
    expect(steps).toHaveAttribute('aria-invalid', 'true')
    expect(steps).toHaveAccessibleDescription('Enter a whole number')
  })

  it('shows an errored email field tied to its message', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Show the email error' }))
    const email = screen.getByLabelText('Email, rejected')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Enter an email address like you@example.com.')
  })

  it('renders the brand mark from the shared component', () => {
    expect(screen.getByText('GT')).toHaveAttribute('aria-hidden', 'true')
  })
})
