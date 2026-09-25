'use client'

import { Field } from './Field'

import type { ComponentPropsWithoutRef } from 'react'

export type PasswordFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  label: string
  hint?: string
  error?: string
}

export function PasswordField({ autoComplete = 'current-password', ...rest }: PasswordFieldProps) {
  return <Field type="password" autoComplete={autoComplete} {...rest} />
}
