import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AuthLayout from './layout'

describe('AuthLayout', () => {
  it('renders its children inside the main landmark', () => {
    render(
      <AuthLayout>
        <p>Sign in content</p>
      </AuthLayout>,
    )
    expect(screen.getByRole('main')).toHaveTextContent('Sign in content')
  })

  it('carries no navigation, because the auth routes stand alone', () => {
    render(
      <AuthLayout>
        <p>Sign in content</p>
      </AuthLayout>,
    )
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
