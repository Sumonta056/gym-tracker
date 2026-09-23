export type NavDestination = {
  href: string
  label: string
  glyph: string
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { href: '/', label: 'Today', glyph: '◧' },
  { href: '/analytics', label: 'Stats', glyph: '◔' },
  { href: '/workouts', label: 'Workouts', glyph: '⛊' },
  { href: '/profile', label: 'Profile', glyph: '☰' },
]

export const NAV_ACTION: NavDestination = { href: '/log', label: 'Log the day', glyph: '✎' }

export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
