import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ProfilePage from './page'

vi.mock('../../../lib/auth/browser', () => ({
  readSignedInEmail: vi.fn(() => Promise.resolve('sam@example.com')),
  signOut: vi.fn(),
}))

describe('ProfilePage', () => {
  it('names the profile screen as its heading', async () => {
    render(<ProfilePage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument()
  })

  it('builds no frame of its own, because the route group layout owns it', async () => {
    render(<ProfilePage />)
    await screen.findByRole('heading', { level: 1, name: 'Profile' })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
