'use client'

import { Field } from './Field'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type EmailFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  label: string
  hint?: string
  error?: ReactNode
}

export function EmailField({
  inputMode = 'email',
  autoComplete = 'email',
  ...rest
}: EmailFieldProps) {
  return <Field type="email" inputMode={inputMode} autoComplete={autoComplete} {...rest} />
}
