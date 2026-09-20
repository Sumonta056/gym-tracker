import { AppShell } from '../components/ui/AppShell'
import { MicroLabel } from '../components/ui/MicroLabel'

const NAV = [{ href: '/', label: 'Today', current: true }]

export default function HomePage() {
  return (
    <AppShell items={NAV}>
      <MicroLabel as="p">Gym Tracker</MicroLabel>
      <h1 className="mt-2 text-3xl font-extrabold">Today</h1>
      <p className="text-muted mt-3 max-w-prose text-sm leading-relaxed">
        The daily tracker arrives in Phase 1. The app shell, the design tokens and the offline
        service worker are in place.
      </p>
    </AppShell>
  )
}
