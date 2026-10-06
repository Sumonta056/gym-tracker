import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ERROR_TITLE } from '../../components/errors/ErrorScreen'
import { reportError } from '../../lib/errors/report'

import AppError from './error'

import type * as Report from '../../lib/errors/report'

vi.mock('../../lib/errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
}))

describe('AppError', () => {
  it('shows the Reload screen for a render error in the app', () => {
    render(<AppError error={new Error('boom')} reset={vi.fn()} />)

    expect(screen.getByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('reports the error from the boundary', () => {
    const error = new Error('boom')
    render(<AppError error={error} reset={vi.fn()} />)

    expect(reportError).toHaveBeenCalledWith(error, { route: '/', source: 'boundary' })
  })
})
