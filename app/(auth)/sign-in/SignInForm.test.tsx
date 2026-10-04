import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SignInForm } from './SignInForm'

type PasswordResult = { status: 'signed-in' } | { status: 'error'; message: string }

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn<(email: string, password: string) => Promise<PasswordResult>>(),
  replace: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
}))

vi.mock('../../../lib/auth/actions', () => ({
  signInWithPassword: mocks.signInWithPassword,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}))

function resetMocks(): void {
  mocks.signInWithPassword.mockReset()
  mocks.signInWithPassword.mockResolvedValue({ status: 'signed-in' })
  mocks.replace.mockReset()
  mocks.refresh.mockReset()
}

describe('SignInForm', () => {
  beforeEach(resetMocks)

  it('opens on the email and password form', () => {
    render(<SignInForm />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
  })

  it('offers no magic link', () => {
    render(<SignInForm />)
    expect(
      screen.queryByRole('button', { name: 'Email me a link instead' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send magic link' })).not.toBeInTheDocument()
  })

  it('drops the no password line', () => {
    render(<SignInForm />)
    expect(
      screen.queryByText('No password. The link signs you in for 30 days.'),
    ).not.toBeInTheDocument()
  })

  it('signs in and replaces the page with the dashboard', async () => {
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled()
    })
    expect(mocks.signInWithPassword).toHaveBeenCalledWith('you@example.com', 'secret')
    expect(mocks.replace).toHaveBeenCalledWith('/')
    expect(mocks.replace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.refresh.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('disables the button and shows a pending state while signing in', async () => {
    let release: (result: PasswordResult) => void = () => undefined
    mocks.signInWithPassword.mockReturnValue(
      new Promise<PasswordResult>((resolve) => {
        release = resolve
      }),
    )

    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    const pending = await screen.findByRole('button', { name: 'Signing in…' })
    expect(pending).toBeDisabled()
    expect(pending).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Password')).toBeDisabled()

    release({ status: 'signed-in' })
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/')
    })
  })

  it('shows the refusal on the password field and stays on the page', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      status: 'error',
      message: 'That email and password do not match.',
    })
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    const field = screen.getByLabelText('Password')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password do not match.',
    )
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('That email and password do not match.')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('shows an error for an invalid email and does not submit', async () => {
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    const field = screen.getByLabelText('Email')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter an email address like you@example.com.')
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('shows an error for an empty password and does not submit', async () => {
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter your password.')
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('clears each error once the user types in its field again', async () => {
    render(<SignInForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getAllByRole('alert')).toHaveLength(2)

    await userEvent.type(screen.getByLabelText('Email'), 'x')
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    await userEvent.type(screen.getByLabelText('Password'), 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('links a new person to the create account screen', () => {
    render(<SignInForm />)
    expect(screen.getByText(/New here\?/)).toContainElement(
      screen.getByRole('link', { name: 'Create an account' }),
    )
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up',
    )
  })

  it('sets the tagline at the prototype 13 px', () => {
    render(<SignInForm />)
    expect(screen.getByText('One log. Works with no signal in the gym.')).toHaveClass('text-[13px]')
  })

  it('tells the user how to install the app on iPhone', () => {
    render(<SignInForm />)
    expect(screen.getByText('Install on iPhone')).toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument()
  })
})
