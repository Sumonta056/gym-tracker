import { render, screen } from '@testing-library/react'
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
      'Status chips',
      'Segmented tabs',
      'Fields',
      'Buttons and the sheet',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
    }
  })

  it('renders the hero card and the three sync chips', () => {
    expect(screen.getByText('Gym time today')).toBeInTheDocument()
    expect(screen.getByText('SYNCED')).toBeInTheDocument()
    expect(screen.getByText('SYNCING')).toBeInTheDocument()
    expect(screen.getByText('OFFLINE')).toBeInTheDocument()
  })

  it('shows the duration field already formatted from stored seconds', () => {
    expect(screen.getByLabelText('Gym time')).toHaveValue('1:12:05')
    expect(screen.getByText('Stored seconds: 4325')).toBeInTheDocument()
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

  it('shows an errored field tied to its message', () => {
    const steps = screen.getByLabelText('Steps')
    expect(steps).toHaveAttribute('aria-invalid', 'true')
    expect(steps).toHaveAccessibleDescription('Enter a whole number')
  })
})
