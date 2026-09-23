import { MicroLabel } from '../../components/ui/MicroLabel'

export default function HomePage() {
  return (
    <>
      <MicroLabel as="p">Gym Tracker</MicroLabel>
      <h1 className="mt-2 text-3xl font-extrabold">Today</h1>
      <p className="text-muted mt-3 max-w-prose text-sm leading-relaxed">
        The daily tracker arrives in Phase 1. The app shell, the design tokens and the offline
        service worker are in place.
      </p>
    </>
  )
}
