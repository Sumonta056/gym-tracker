export type Site = 'youtube' | 'instagram' | 'web'
export type OpenWay = 'new-tab' | 'same-window' | 'app-scheme'
export type LinkTarget = { href: string; target: '_blank' | undefined }

export const STANDALONE_WAY: Readonly<Record<Exclude<Site, 'web'>, OpenWay>> = {
  youtube: 'new-tab',
  instagram: 'new-tab',
}

const HOSTS: ReadonlyArray<readonly [string, Exclude<Site, 'web'>]> = [
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['instagram.com', 'instagram'],
]

const BLOCKED: LinkTarget = { href: 'about:blank', target: undefined }

function webHostname(url: string): string | null {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null

    return parsed.hostname.toLowerCase()
  } catch {
    return null
  }
}

export function siteOf(url: string): Site {
  const hostname = webHostname(url)

  if (hostname === null) return 'web'

  for (const [host, site] of HOSTS) {
    if (hostname === host || hostname.endsWith(`.${host}`)) return site
  }

  return 'web'
}

export function appSchemeHref(url: string, site: Exclude<Site, 'web'>): string {
  return url.replace(/^https?:/i, `${site}:`)
}

export function targetFor(url: string, site: Exclude<Site, 'web'>, way: OpenWay): LinkTarget {
  if (way === 'same-window') return { href: url, target: undefined }
  if (way === 'app-scheme') return { href: appSchemeHref(url, site), target: undefined }

  return { href: url, target: '_blank' }
}

export function openTarget(url: string, context: { standalone: boolean }): LinkTarget {
  if (webHostname(url) === null) return BLOCKED

  const site = siteOf(url)

  if (!context.standalone || site === 'web') return { href: url, target: '_blank' }

  return targetFor(url, site, STANDALONE_WAY[site])
}
