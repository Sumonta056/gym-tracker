'use client'

import { useEffect, useState } from 'react'

import { Card } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/Field'
import { appSchemeHref, siteOf } from '../../../lib/links/openTarget'

import type { Site } from '../../../lib/links/openTarget'

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

const LINK_CLASS =
  'border-border bg-surface-2 text-text flex min-h-11 items-center rounded-full border px-4 text-[15px] font-bold'

function readStandalone(): boolean {
  const byMedia = window.matchMedia('(display-mode: standalone)').matches
  const byNavigator = (window.navigator as NavigatorWithStandalone).standalone === true

  return byMedia || byNavigator
}

function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)

    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

type Way = { label: string; href: string; target?: '_blank' }

function waysFor(url: string, site: Site): Way[] {
  const scheme = site === 'web' ? url : appSchemeHref(url, site)

  return [
    { label: '1 · New tab', href: url, target: '_blank' },
    { label: '2 · Same window', href: url },
    { label: '3 · App scheme', href: scheme },
  ]
}

export default function LinkTestPage() {
  const [standalone, setStandalone] = useState<boolean | null>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    setStandalone(readStandalone())
  }, [])

  const url = value.trim()
  const valid = isWebUrl(url)
  const site = valid ? siteOf(url) : 'web'

  return (
    <>
      <header>
        <h1 className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]">
          Link test
        </h1>
        <p className="text-muted mt-1 text-[13px]">
          Open this from the home screen app. Tap each link, come back, and note which one opens the
          app.
        </p>
      </header>
      <div className="mt-4 flex max-w-xl flex-col gap-3">
        <Card>
          <p data-testid="standalone" className="text-text text-[15px] font-bold">
            {standalone === null
              ? 'Checking the display mode…'
              : standalone
                ? 'Running as the home screen app'
                : 'Running in a browser tab'}
          </p>
        </Card>
        <Card>
          <Field
            label="Instagram or YouTube link"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
            }}
            error={url !== '' && !valid ? 'Paste a link that starts with https://' : undefined}
          />
        </Card>
        {valid ? (
          <Card>
            <p data-testid="site" className="text-muted text-[13px]">
              Read as: {site}
            </p>
            <ul className="mt-2 flex flex-col gap-3">
              {waysFor(url, site).map((way) => (
                <li key={way.label} className="flex flex-col gap-1">
                  <a
                    href={way.href}
                    target={way.target}
                    rel={way.target === undefined ? undefined : 'noopener noreferrer'}
                    className={LINK_CLASS}
                  >
                    {way.label}
                  </a>
                  <span className="text-muted text-xs break-all">{way.href}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  )
}
