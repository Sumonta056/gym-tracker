import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SignUpForm } from './SignUpForm'

import type { SignUpResult } from '../../../lib/auth/actions'
import type { SignUpInput } from '../../../lib/schema/signUp'

const CHOSEN = 'long enough'

const mocks = vi.hoisted(() => ({
  signUp: vi.fn<(input: SignUpInput) => Promise<SignUpResult>>(),
  replace: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
}))

vi.mock('../../../lib/auth/actions', () => ({
  signUp: mocks.signUp,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}))

async function fillValid(): Promise<void> {
  await userEvent.type(screen.getByLabelText('Name'), 'Sumonta')
  await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
  await userEvent.type(screen.getByLabelText('Password'), CHOSEN)
}

async function submit(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('SignUpForm', () => {
  beforeEach(() => {
    mocks.signUp.mockReset()
    mocks.signUp.mockResolvedValue({ status: 'signed-in' })
    mocks.replace.mockReset()
    mocks.refresh.mockReset()
  })

  it('opens on the name, email and password fields', () => {
    render(<SignUpForm />)
    expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name')
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Create account' })).toHaveAttribute('type', 'submit')
  })

  it('names the app as its heading', () => {
    render(<SignUpForm />)
    expect(screen.getByRole('heading', { level: 1, name: 'Gym Tracker' })).toBeInTheDocument()
  })

  it('ties the password hint to the password field', () => {
    render(<SignUpForm />)
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('8 or more characters')
  })

  it('shows the name error on submit and does not send', async () => {
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.type(screen.getByLabelText('Password'), CHOSEN)
    await submit()

    const field = screen.getByLabelText('Name')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter your name.')
    expect(mocks.signUp).not.toHaveBeenCalled()
  })

  it('refuses a name made only of spaces', async () => {
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText('Name'), '   ')
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.type(screen.getByLabelText('Password'), CHOSEN)
    await submit()

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter your name.')
    expect(mocks.signUp).not.toHaveBeenCalled()
  })

  it('shows the email error on submit and does not send', async () => {
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText('Name'), 'Sumonta')
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.type(screen.getByLabelText('Password'), CHOSEN)
    await submit()

    const field = screen.getByLabelText('Email')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter an email address like you@example.com.')
    expect(mocks.signUp).not.toHaveBeenCalled()
  })

  it('shows the password error after the hint on submit and does not send', async () => {
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText('Name'), 'Sumonta')
    await userEvent.type(screen.getByLabelText('Email'), 'you@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await submit()

    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('8 or more characters Use 8 or more characters.')
    expect(mocks.signUp).not.toHaveBeenCalled()
  })

  it('shows every field error at once on an empty submit', async () => {
    render(<SignUpForm />)
    await submit()
    expect(screen.getAllByRole('alert')).toHaveLength(3)
  })

  it('clears each error once the user types in its field again', async () => {
    render(<SignUpForm />)
    await submit()

    await userEvent.type(screen.getByLabelText('Name'), 'x')
    expect(screen.getAllByRole('alert')).toHaveLength(2)

    await userEvent.type(screen.getByLabelText('Email'), 'x')
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    await userEvent.type(screen.getByLabelText('Password'), 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sends the typed name, email and password', async () => {
    render(<SignUpForm />)
    await fillValid()
    await submit()

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalledWith({
        name: 'Sumonta',
        email: 'you@example.com',
        password: CHOSEN,
      })
    })
  })

  it('disables the button and shows a pending state while creating the account', async () => {
    let release: (result: SignUpResult) => void = () => undefined
    mocks.signUp.mockReturnValue(
      new Promise<SignUpResult>((resolve) => {
        release = resolve
      }),
    )

    render(<SignUpForm />)
    await fillValid()
    await submit()

    const pending = await screen.findByRole('button', { name: 'Creating account…' })
    expect(pending).toBeDisabled()
    expect(pending).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText('Name')).toBeDisabled()

    release({ status: 'signed-in' })
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/')
    })
  })

  it('replaces the page with Today, then refreshes, once signed in', async () => {
    render(<SignUpForm />)
    await fillValid()
    await submit()

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled()
    })
    expect(mocks.replace).toHaveBeenCalledWith('/')
    expect(mocks.replace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.refresh.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('shows the exists text on the email field with a link to sign in', async () => {
    mocks.signUp.mockResolvedValue({ status: 'exists' })
    render(<SignUpForm />)
    await fillValid()
    await submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('An account with this email exists. Sign in instead.')
    expect(screen.getByRole('link', { name: 'Sign in instead.' })).toHaveAttribute(
      'href',
      '/sign-in',
    )
    const field = screen.getByLabelText('Email')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('An account with this email exists. Sign in instead.')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('shows an error message in an alert and stays on the page', async () => {
    mocks.signUp.mockResolvedValue({
      status: 'error',
      message: 'Too many tries. Wait a minute and try again.',
    })
    render(<SignUpForm />)
    await fillValid()
    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many tries. Wait a minute and try again.',
    )
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('clears the error message on the next submit', async () => {
    mocks.signUp.mockResolvedValueOnce({
      status: 'error',
      message: 'We could not create the account. Try again.',
    })
    render(<SignUpForm />)
    await fillValid()
    await submit()
    await screen.findByRole('alert')

    await submit()
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/')
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('goes to the code screen with the email when the account needs a code', async () => {
    mocks.signUp.mockResolvedValue({ status: 'needs-code', email: 'you+gym@example.com' })
    render(<SignUpForm />)
    await fillValid()
    await submit()

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/verify?email=you%2Bgym%40example.com')
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('links to the sign in screen for a person who has an account', () => {
    render(<SignUpForm />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
  })
})
