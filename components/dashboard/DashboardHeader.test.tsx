import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DashboardHeader, initialOf } from './DashboardHeader'

describe('DashboardHeader', () => {
  it('names the day and the date as the page heading', () => {
    render(<DashboardHeader date="2026-09-13" displayName="Sumonta" />)
    expect(screen.getByText('Sunday')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '13 September' })).toBeInTheDocument()
  })

  it('links the avatar to the profile with a label', () => {
    render(<DashboardHeader date="2026-09-13" displayName="Sumonta" />)
    const avatar = screen.getByRole('link', { name: 'Profile' })
    expect(avatar).toHaveAttribute('href', '/profile')
    expect(avatar).toHaveTextContent('S')
  })

  it('shows the sync chip beside the avatar', () => {
    render(<DashboardHeader date="2026-09-13" displayName="Sumonta" />)
    expect(screen.getByRole('status')).toHaveTextContent('SYNCED')
  })

  it('gives the avatar a 44 px target', () => {
    render(<DashboardHeader date="2026-09-13" displayName={null} />)
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveClass('size-11')
  })
})

describe('initialOf', () => {
  it('takes the first letter of the name in upper case', () => {
    expect(initialOf('  sumonta')).toBe('S')
  })

  it('falls back to the profile glyph with no name', () => {
    expect(initialOf(null)).toBe('☰')
  })

  it('falls back to the profile glyph with a blank name', () => {
    expect(initialOf('   ')).toBe('☰')
  })
})
