import { describe, expect, it } from 'vitest'

import { MAX_NAME_LENGTH, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, signUpSchema } from './signUp'

import type { SignUpInput } from './signUp'

const VALID: SignUpInput = {
  name: 'Sam',
  email: 'you@example.com',
  password: 'x'.repeat(MIN_PASSWORD_LENGTH),
}

function parse(overrides: Record<string, unknown> = {}) {
  return signUpSchema.safeParse({ ...VALID, ...overrides })
}

function firstIssue(result: ReturnType<typeof parse>) {
  if (result.success) {
    throw new Error('expected the parse to fail')
  }

  const [issue] = result.error.issues

  if (issue === undefined) {
    throw new Error('expected at least one issue')
  }

  return issue
}

describe('signUpSchema', () => {
  it('accepts a name, an email and a password', () => {
    expect(parse().success).toBe(true)
  })

  it('trims the name', () => {
    expect(parse({ name: '  Sam  ' }).data?.name).toBe('Sam')
  })

  it('refuses a name that is only spaces', () => {
    const issue = firstIssue(parse({ name: '   ' }))
    expect(issue.path).toEqual(['name'])
    expect(issue.message).toBe('Enter your name.')
  })

  it('accepts a name of exactly 60 characters', () => {
    expect(parse({ name: 'a'.repeat(MAX_NAME_LENGTH) }).success).toBe(true)
  })

  it('refuses a name longer than 60 characters', () => {
    const issue = firstIssue(parse({ name: 'a'.repeat(MAX_NAME_LENGTH + 1) }))
    expect(issue.path).toEqual(['name'])
    expect(issue.message).toBe('A name cannot be longer than 60 characters.')
  })

  it('normalises the email', () => {
    expect(parse({ email: '  You@Example.com ' }).data?.email).toBe('you@example.com')
  })

  it('refuses an invalid email', () => {
    const issue = firstIssue(parse({ email: 'not-an-email' }))
    expect(issue.path).toEqual(['email'])
    expect(issue.message).toBe('Enter an email address like you@example.com.')
  })

  it('keeps the password exactly as typed', () => {
    const typed = ` ${'x'.repeat(MIN_PASSWORD_LENGTH)} `
    expect(parse({ password: typed }).data?.password).toBe(typed)
  })

  it('accepts a password of exactly 8 characters', () => {
    expect(parse({ password: 'a'.repeat(MIN_PASSWORD_LENGTH) }).success).toBe(true)
  })

  it('refuses a password shorter than 8 characters', () => {
    const issue = firstIssue(parse({ password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1) }))
    expect(issue.path).toEqual(['password'])
    expect(issue.message).toBe('Use 8 or more characters.')
  })

  it('accepts a password of exactly 72 characters', () => {
    expect(parse({ password: 'a'.repeat(MAX_PASSWORD_LENGTH) }).success).toBe(true)
  })

  it('refuses a password longer than 72 characters', () => {
    const issue = firstIssue(parse({ password: 'a'.repeat(MAX_PASSWORD_LENGTH + 1) }))
    expect(issue.path).toEqual(['password'])
    expect(issue.message).toBe('A password cannot be longer than 72 characters.')
  })

  it('refuses a missing field', () => {
    const issue = firstIssue(signUpSchema.safeParse({ email: VALID.email }))
    expect(issue.path).toEqual(['name'])
  })
})
