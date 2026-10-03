import { z } from 'zod'

import { isValidEmail, normaliseEmail } from '../auth/email'

export const MAX_NAME_LENGTH = 60
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72

export const signUpSchema = z.object({
  name: z
    .string({ error: 'Enter your name.' })
    .trim()
    .min(1, { error: 'Enter your name.' })
    .max(MAX_NAME_LENGTH, {
      error: `A name cannot be longer than ${String(MAX_NAME_LENGTH)} characters.`,
    }),
  email: z
    .string({ error: 'Enter an email address like you@example.com.' })
    .refine(isValidEmail, { error: 'Enter an email address like you@example.com.' })
    .transform(normaliseEmail),
  password: z
    .string({ error: 'Use 8 or more characters.' })
    .min(MIN_PASSWORD_LENGTH, { error: 'Use 8 or more characters.' })
    .max(MAX_PASSWORD_LENGTH, {
      error: `A password cannot be longer than ${String(MAX_PASSWORD_LENGTH)} characters.`,
    }),
})

export type SignUpInput = z.infer<typeof signUpSchema>
