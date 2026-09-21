'use client'

import { Field } from './Field'

import type { ComponentPropsWithoutRef } from 'react'

export type NumberFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  label: string
  unit?: string
  hint?: string
  error?: string
}

export function NumberField({ unit, inputMode = 'decimal', ...rest }: NumberFieldProps) {
  return <Field type="text" inputMode={inputMode} adornment={unit} {...rest} />
}
