import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProfileHeader } from './ProfileHeader'

describe('ProfileHeader', () => {
  it('names the screen and the signed in email', () => {
    render(
      <ProfileHeader
        email="sam@example.com"
        report={{ status: 'synced', pending: 0, failed: 0 }}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByText('sam@example.com')).toBeInTheDocument()
  })

  it('shows the sync chip', () => {
    render(<ProfileHeader email={null} report={{ status: 'offline', pending: 0, failed: 0 }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Offline')
  })

  it('leaves the email out when no session is known', () => {
    render(<ProfileHeader email={null} report={{ status: 'synced', pending: 0, failed: 0 }} />)
    expect(screen.queryByText('@', { exact: false })).not.toBeInTheDocument()
  })
})
