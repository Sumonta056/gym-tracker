import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { db, LOCAL_PROFILE_ID } from '../../lib/db/dexie'
import { PROFILE } from '../../tests/fixtures/dashboard'

import { initialOf, ProfileAvatarLink } from './ProfileAvatarLink'

beforeEach(async () => {
  await db.open()
  await db.profiles.clear()
})

describe('ProfileAvatarLink', () => {
  it('is a link named "Profile" to /profile, 44 px round', () => {
    render(<ProfileAvatarLink />)

    const link = screen.getByRole('link', { name: 'Profile' })
    expect(link).toHaveAttribute('href', '/profile')
    expect(link).toHaveClass('size-11', 'rounded-full')
  })

  it('shows the first letter of the profile name', async () => {
    await db.profiles.put({ ...PROFILE, id: LOCAL_PROFILE_ID, display_name: 'sumonta' })
    render(<ProfileAvatarLink />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Profile' })).toHaveTextContent('S')
    })
  })

  it('shows the person glyph when there is no name', () => {
    render(<ProfileAvatarLink />)

    expect(screen.getByRole('link', { name: 'Profile' })).toHaveTextContent('☰')
  })

  it('is hidden from 1024 px', () => {
    render(<ProfileAvatarLink className="extra" />)

    expect(screen.getByRole('link', { name: 'Profile' })).toHaveClass('lg:hidden', 'extra')
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
