import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SignInForm } from './SignInForm'

type SendResult = { status: 'sent'; email: string } | { status: 'error'; message: string }

type PasswordResult = { status: 'signed-in' } | { status: 'error'; message: string }

const mocks = vi.hoisted(() => ({
  sendMagicLink: vi.fn<(email: string) => Promise<SendResult>>(),
  signInWithPassword: vi.fn<(email: string, password: string) => Promise<PasswordResult>>(),
  replace: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
}))

vi.mock('../../../lib/auth/actions', () => ({
  sendMagicLink: mocks.sendMagicLink,
  signInWithPassword: mocks.signInWithPassword,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}))

async function openLinkMode(): Promise<void> {
  render(<SignInForm />)
  await userEvent.click(screen.getByRole('button', { name: 'Email me a link instead' }))
}

function resetMocks(): void {
  mocks.sendMagicLink.mockReset()
  mocks.sendMagicLink.mockResolvedValue({ status: 'sent', email: 'you@example.com' })
  mocks.signInWithPassword.mockReset()
  mocks.signInWithPassword.mockResolvedValue({ status: 'signed-in' })
  mocks.replace.mockReset()
  mocks.refresh.mockReset()
}

describe('SignInForm in password mode', () => {
  beforeEach(resetMocks)

  it('opens on the email and password form', () => {
    render(<SignInForm />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
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
    expect(screen.getByRole('button', { name: 'Email me a link instead' })).toBeDisabled()

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

  it('switches to the magic link form and back, keeping the email', async () => {
    await openLinkMode()
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    expect(screen.getByRole('button', { name: 'Send magic link' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Use password instead' }))
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('you@example.com')
  })

  it('tells the user how to install the app on iPhone', () => {
    render(<SignInForm />)
    expect(screen.getByText('Install on iPhone')).toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument()
  })
})

describe('SignInForm in magic link mode', () => {
  beforeEach(resetMocks)

  it('ties the email field to a visible label', async () => {
    await openLinkMode()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows an error for an invalid email and does not submit', async () => {
    await openLinkMode()
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter an email address like you@example.com.',
    )
    expect(mocks.sendMagicLink).not.toHaveBeenCalled()
  })

  it('ties the error to the input and marks the input invalid', async () => {
    await openLinkMode()
    const field = screen.getByLabelText('Email')
    await userEvent.type(field, 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter an email address like you@example.com.')
  })

  it('clears the error once the user types again', async () => {
    await openLinkMode()
    const field = screen.getByLabelText('Email')
    await userEvent.type(field, 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await userEvent.type(field, 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables the button and shows a pending state while sending', async () => {
    let release: (result: SendResult) => void = () => undefined
    mocks.sendMagicLink.mockReturnValue(
      new Promise<SendResult>((resolve) => {
        release = resolve
      }),
    )

    await openLinkMode()
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    const pending = await screen.findByRole('button', { name: 'Sending the link…' })
    expect(pending).toBeDisabled()
    expect(pending).toHaveAttribute('aria-busy', 'true')

    release({ status: 'sent', email: 'you@example.com' })
    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })
  })

  it('shows the check your email state after a send', async () => {
    await openLinkMode()
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText('you@example.com')).toBeInTheDocument()
    expect(mocks.sendMagicLink).toHaveBeenCalledWith('you@example.com')
  })

  it('announces the check your email state and moves focus to it', async () => {
    await openLinkMode()
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    const confirmation = await screen.findByRole('status')
    expect(confirmation).toHaveTextContent('Check your email')
    await waitFor(() => {
      expect(confirmation).toHaveFocus()
    })
  })

  it('breaks a long email address inside its card instead of pushing the page sideways', async () => {
    const long = 'a.very.long.name.that.keeps.going.and.going@an-equally-long-domain.example.com'
    mocks.sendMagicLink.mockResolvedValue({ status: 'sent', email: long })
    await openLinkMode()
    await userEvent.type(screen.getByLabelText('Email'), long)
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    expect(await screen.findByText(long)).toHaveClass('break-words', 'min-w-0')
  })

  it('sets the secondary lines at the prototype 13 px', async () => {
    await openLinkMode()
    expect(screen.getByText('One log. Works with no signal in the gym.')).toHaveClass('text-[13px]')
    expect(screen.getByText('No password. The link signs you in for 30 days.')).toHaveClass(
      'text-[13px]',
    )
  })

  it('goes back to the form from the check your email state', async () => {
    await openLinkMode()
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Use a different email' }))

    expect(screen.getByRole('button', { name: 'Send magic link' })).toBeInTheDocument()
  })

  it('shows the message when the send fails', async () => {
    mocks.sendMagicLink.mockResolvedValue({
      status: 'error',
      message: 'The link could not be sent.',
    })
    await openLinkMode()
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The link could not be sent.')
    expect(screen.getByRole('button', { name: 'Send magic link' })).toBeEnabled()
  })

  it('keeps the install card', async () => {
    await openLinkMode()
    expect(screen.getByText('Install on iPhone')).toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument()
  })
})
