import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import LinkTestPage from './page'

const REEL = 'https://www.instagram.com/reel/Cx1/'

function stubDisplay(matches: boolean, navigatorStandalone?: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches })),
  )
  Object.defineProperty(window.navigator, 'standalone', {
    value: navigatorStandalone,
    configurable: true,
  })
}

async function paste(url: string): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByLabelText('Instagram or YouTube link'))
  await user.paste(url)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LinkTestPage', () => {
  it('names the page and tells the owner what to do', () => {
    stubDisplay(false)
    render(<LinkTestPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Link test' })).toBeInTheDocument()
    expect(screen.getByText(/Open this from the home screen app/)).toBeInTheDocument()
  })

  it('shows no link before a URL is pasted', () => {
    stubDisplay(false)
    render(<LinkTestPage />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('offers the 3 ways for a pasted Instagram link', async () => {
    stubDisplay(false)
    render(<LinkTestPage />)
    await paste(`  ${REEL}  `)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      REEL,
      REEL,
      'instagram://www.instagram.com/reel/Cx1/',
    ])
    expect(links.map((link) => link.getAttribute('target'))).toEqual(['_blank', null, null])
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
    expect(links.map((link) => link.textContent)).toEqual([
      '1 · New tab',
      '2 · Same window',
      '3 · App scheme',
    ])
    expect(screen.getByTestId('site')).toHaveTextContent('instagram')
  })

  it('prints the exact href under each link', async () => {
    stubDisplay(false)
    render(<LinkTestPage />)
    await paste(REEL)
    expect(screen.getAllByText(REEL)).toHaveLength(2)
    expect(screen.getByText('instagram://www.instagram.com/reel/Cx1/')).toBeInTheDocument()
  })

  it('keeps the https link as the third way for a site it does not know', async () => {
    stubDisplay(false)
    render(<LinkTestPage />)
    await paste('https://example.com/a')
    expect(screen.getAllByRole('link')[2]).toHaveAttribute('href', 'https://example.com/a')
    expect(screen.getByTestId('site')).toHaveTextContent('web')
  })

  it('refuses text that is not an http link', async () => {
    stubDisplay(false)
    render(<LinkTestPage />)
    await paste('javascript:alert(1)')
    expect(screen.getByRole('alert')).toHaveTextContent('Paste a link that starts with https://')
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('refuses text that is not a URL', async () => {
    stubDisplay(false)
    render(<LinkTestPage />)
    await paste('hello')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('reports a browser tab when the display mode is not standalone', () => {
    stubDisplay(false)
    render(<LinkTestPage />)
    expect(screen.getByTestId('standalone')).toHaveTextContent('Running in a browser tab')
  })

  it('reports the home screen app from the display-mode media query', () => {
    stubDisplay(true)
    render(<LinkTestPage />)
    expect(screen.getByTestId('standalone')).toHaveTextContent('Running as the home screen app')
  })

  it('reports the home screen app from navigator.standalone', () => {
    stubDisplay(false, true)
    render(<LinkTestPage />)
    expect(screen.getByTestId('standalone')).toHaveTextContent('Running as the home screen app')
  })
})
