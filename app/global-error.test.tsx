import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ERROR_BODY, ERROR_TITLE } from '../components/errors/ErrorScreen'

import GlobalError from './global-error'

vi.mock('./globals.css', () => ({}))

vi.mock('next/font/google', () => ({
  Figtree: () => ({ variable: 'font-figtree' }),
}))

describe('GlobalError', () => {
  it('renders its own html and body around the error screen', () => {
    const markup = renderToStaticMarkup(<GlobalError error={new Error('boom')} reset={vi.fn()} />)

    expect(markup).toMatch(/^<html lang="en" class="font-figtree">(<head><\/head>)?<body/)
    expect(markup).toContain(ERROR_TITLE)
    expect(markup).toContain(ERROR_BODY)
    expect(markup).toContain('Copy error')
  })
})
