export type NavDestination = {
  href: string
  label: string
  glyph: string
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { href: '/', label: 'Today', glyph: '◧' },
  { href: '/analytics', label: 'Stats', glyph: '◔' },
  { href: '/workouts', label: 'Workouts', glyph: '⛊' },
  { href: '/saved', label: 'Saved', glyph: '▶' },
]

export const PROFILE_DESTINATION: NavDestination = {
  href: '/profile',
  label: 'Profile',
  glyph: '☰',
}

export const SIDEBAR_DESTINATIONS: readonly NavDestination[] = [
  ...NAV_DESTINATIONS,
  PROFILE_DESTINATION,
]

export const NAV_ACTION: NavDestination = { href: '/log', label: 'Log the day', glyph: '✎' }

const ALSO_CURRENT_ON: Readonly<Record<string, readonly string[]>> = {
  '/workouts': ['/workout'],
}

function onPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return [href, ...(ALSO_CURRENT_ON[href] ?? [])].some((path) => onPath(pathname, path))
}
