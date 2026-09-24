import { MicroLabel } from '../../../components/ui/MicroLabel'

export default function WorkoutsPage() {
  return (
    <>
      <MicroLabel as="p">Gym Tracker</MicroLabel>
      <h1 className="mt-2 text-[23px] leading-tight font-bold tracking-[-0.6px]">Workouts</h1>
      <p className="text-muted mt-3 max-w-prose text-sm leading-relaxed">
        The live workout log arrives in Phase 2. The daily tracker is on the Today screen.
      </p>
    </>
  )
}
