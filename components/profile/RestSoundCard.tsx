'use client'

import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { SegmentedTabs } from '../ui/SegmentedTabs'

type SoundChoice = 'on' | 'muted'

export const SOUND_OPTIONS: { value: SoundChoice; label: string }[] = [
  { value: 'on', label: 'Sound on' },
  { value: 'muted', label: 'Muted' },
]

export type RestSoundCardProps = {
  muted: boolean
  onMutedChange: (muted: boolean) => void
  error?: string | null
  className?: string
}

export function soundStatement(muted: boolean): string {
  return muted
    ? 'No sound when a rest ends. The screen still says so.'
    : 'A short sound plays when a rest ends.'
}

export function RestSoundCard({
  muted,
  onMutedChange,
  error = null,
  className,
}: RestSoundCardProps) {
  return (
    <Card className={className} data-testid="rest-sound-card">
      <MicroLabel as="p">Rest timer</MicroLabel>
      <SegmentedTabs
        label="Rest sound"
        options={SOUND_OPTIONS}
        value={muted ? 'muted' : 'on'}
        onValueChange={(choice) => {
          onMutedChange(choice === 'muted')
        }}
        className="mt-2.5"
      />
      <p className="text-text mt-2.5 text-sm font-semibold" aria-live="polite">
        {soundStatement(muted)}
      </p>
      <p className="text-muted mt-1 text-xs">The phone vibrates at zero where it can.</p>
      {error === null ? null : (
        <p role="alert" className="text-danger mt-2 text-xs">
          {error}
        </p>
      )}
    </Card>
  )
}
