'use client'

import { SegmentedTabs } from '../ui/SegmentedTabs'

import type { ImportChoice } from '../../lib/db/repository'

export const CHOICE_OPTIONS: { value: ImportChoice; label: string }[] = [
  { value: 'skip', label: 'Skip' },
  { value: 'overwrite', label: 'Overwrite' },
  { value: 'merge', label: 'Merge' },
]

export const CHOICE_LABEL: Record<ImportChoice, string> = {
  skip: 'Skip',
  overwrite: 'Overwrite',
  merge: 'Merge',
}

export const CONFLICT_QUESTION =
  'This date already has a day in the app. What should the import do?'

export const CHOICE_HINT: Record<ImportChoice | 'none', string> = {
  none: 'Choose Skip, Overwrite or Merge to apply.',
  skip: 'Skip keeps that day as it is.',
  overwrite:
    'Overwrite replaces that day with this row. A blank cell clears its field. The note stays.',
  merge: 'Merge fills only the empty fields of that day.',
}

export type ImportConflictProps = {
  label: string
  choice: ImportChoice | null
  onChoose: (choice: ImportChoice) => void
}

export function ImportConflict({ label, choice, onChoose }: ImportConflictProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5" data-testid="import-conflict">
      <p className="text-muted text-[13px]">{CONFLICT_QUESTION}</p>
      <SegmentedTabs
        label={`${label}, already logged`}
        options={CHOICE_OPTIONS}
        value={choice}
        onValueChange={onChoose}
        className="[&>button]:px-2"
      />
      <p className="text-muted text-xs">{CHOICE_HINT[choice ?? 'none']}</p>
    </div>
  )
}
