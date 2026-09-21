import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SignInForm } from './SignInForm'

type SendResult = { status: 'sent'; email: string } | { status: 'error'; message: string }

const mocks = vi.hoisted(() => ({
  sendMagicLink: vi.fn<(email: string) => Promise<SendResult>>(),
}))

vi.mock('../../../lib/auth/actions', () => ({
  sendMagicLink: mocks.sendMagicLink,
}))

describe('SignInForm', () => {
  beforeEach(() => {
    mocks.sendMagicLink.mockReset()
    mocks.sendMagicLink.mockResolvedValue({ status: 'sent', email: 'you@example.com' })
  })

  it('ties the email field to a visible label', () => {
    render(<SignInForm />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows an error for an invalid email and does not submit', async () => {
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter an email address like you@example.com.',
    )
    expect(mocks.sendMagicLink).not.toHaveBeenCalled()
  })

  it('ties the error to the input and marks the input invalid', async () => {
    render(<SignInForm />)
    const field = screen.getByLabelText('Email')
    await userEvent.type(field, 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter an email address like you@example.com.')
  })

  it('clears the error once the user types again', async () => {
    render(<SignInForm />)
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

    render(<SignInForm />)
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
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText('you@example.com')).toBeInTheDocument()
    expect(mocks.sendMagicLink).toHaveBeenCalledWith('you@example.com')
  })

  it('announces the check your email state and moves focus to it', async () => {
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    const confirmation = await screen.findByRole('status')
    expect(confirmation).toHaveTextContent('Check your email')
    await waitFor(() => {
      expect(confirmation).toHaveFocus()
    })
  })

  it('goes back to the form from the check your email state', async () => {
    render(<SignInForm />)
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
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The link could not be sent.')
    expect(screen.getByRole('button', { name: 'Send magic link' })).toBeEnabled()
  })

  it('tells the user how to install the app on iPhone', () => {
    render(<SignInForm />)
    expect(screen.getByText('Install on iPhone')).toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument()
  })
})
