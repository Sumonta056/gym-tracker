import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AppLayout from './layout'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

function setup() {
  render(
    <AppLayout>
      <p>Signed in content</p>
    </AppLayout>,
  )
}

describe('AppLayout', () => {
  it('renders its children inside the main landmark', () => {
    setup()
    expect(screen.getByRole('main')).toHaveTextContent('Signed in content')
  })

  it('carries both navigations, so every signed-in route sits in one shell', () => {
    setup()
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Bottom navigation' })).toBeInTheDocument()
  })
})
