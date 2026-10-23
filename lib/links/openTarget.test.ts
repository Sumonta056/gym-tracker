import { describe, expect, it } from 'vitest'

import { appSchemeHref, openTarget, siteOf, STANDALONE_WAY, targetFor } from './openTarget'

const YOUTUBE = 'https://www.youtube.com/watch?v=abc'
const INSTAGRAM = 'https://www.instagram.com/reel/Cx1/'
const WEB = 'https://example.com/a'

function expected(url: string, way: (typeof STANDALONE_WAY)['youtube']) {
  if (way === 'new-tab') return { href: url, target: '_blank' }
  if (way === 'same-window') return { href: url, target: undefined }
  return { href: appSchemeHref(url, siteOf(url) as 'youtube' | 'instagram'), target: undefined }
}

describe('siteOf', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://m.youtube.com/shorts/abc', 'youtube'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.instagram.com/reel/Cx1/', 'instagram'],
    ['https://instagram.com/p/Cx1/', 'instagram'],
    ['https://notyoutube.com/x', 'web'],
    ['https://example.com/a', 'web'],
    ['not a url', 'web'],
    ['https://youtube.com.evil.test/x', 'web'],
    ['https://evilyoutube.com/x', 'web'],
    ['HTTPS://WWW.YOUTUBE.COM/watch?v=x', 'youtube'],
    ['javascript://youtube.com/%0Aalert(1)', 'web'],
    ['ftp://youtube.com/x', 'web'],
  ])('reads %s as %s', (url, site) => {
    expect(siteOf(url)).toBe(site)
  })
})

describe('appSchemeHref', () => {
  it('swaps the https scheme for youtube://', () => {
    expect(appSchemeHref('https://www.youtube.com/watch?v=abc', 'youtube')).toBe(
      'youtube://www.youtube.com/watch?v=abc',
    )
  })
  it('swaps the https scheme for instagram://', () => {
    expect(appSchemeHref('https://www.instagram.com/reel/Cx1/', 'instagram')).toBe(
      'instagram://www.instagram.com/reel/Cx1/',
    )
  })
})

describe('openTarget', () => {
  it('opens every link in a new tab on the laptop', () => {
    for (const url of [YOUTUBE, INSTAGRAM, WEB]) {
      expect(openTarget(url, { standalone: false })).toEqual({ href: url, target: '_blank' })
    }
  })

  it('opens a plain web link in a new tab in the home screen app', () => {
    expect(openTarget(WEB, { standalone: true })).toEqual({ href: WEB, target: '_blank' })
  })

  it('opens a YouTube link the way STANDALONE_WAY names in the home screen app', () => {
    expect(openTarget(YOUTUBE, { standalone: true })).toEqual(
      expected(YOUTUBE, STANDALONE_WAY.youtube),
    )
  })

  it('opens an Instagram link the way STANDALONE_WAY names in the home screen app', () => {
    expect(openTarget(INSTAGRAM, { standalone: true })).toEqual(
      expected(INSTAGRAM, STANDALONE_WAY.instagram),
    )
  })

  it('returns about:blank for a URL it cannot parse', () => {
    expect(openTarget('not a url', { standalone: true })).toEqual({
      href: 'about:blank',
      target: undefined,
    })
  })

  it.each([
    'javascript://youtube.com/%0Aalert(1)',
    'data:text/html,hi',
    'ftp://youtube.com/x',
    'instagram://www.instagram.com/reel/x',
  ])('returns about:blank for %s on every device', (url) => {
    for (const standalone of [true, false]) {
      expect(openTarget(url, { standalone })).toEqual({ href: 'about:blank', target: undefined })
    }
  })
})

describe('targetFor', () => {
  it('opens in a new tab for new-tab', () => {
    expect(targetFor(YOUTUBE, 'youtube', 'new-tab')).toEqual({ href: YOUTUBE, target: '_blank' })
  })
  it('keeps the window and the https link for same-window', () => {
    expect(targetFor(INSTAGRAM, 'instagram', 'same-window')).toEqual({
      href: INSTAGRAM,
      target: undefined,
    })
  })
  it('swaps the scheme and keeps the window for app-scheme', () => {
    expect(targetFor(YOUTUBE, 'youtube', 'app-scheme')).toEqual({
      href: 'youtube://www.youtube.com/watch?v=abc',
      target: undefined,
    })
  })
})
