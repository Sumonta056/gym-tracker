'use client'

import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SheetModal } from '../ui/SheetModal'

import type { ImportCounts } from './reviewState'

export const CONFIRM_TITLE = 'Apply the import?'

export const OVERWRITE_MEANS =
  'Overwrite replaces a day with its sheet row. A blank sheet cell clears that field. The note of the day stays.'

export const MERGE_MEANS =
  'Merge fills only the empty fields of a day and keeps the rest. A Merge that fills nothing writes nothing and counts as skipped.'

export const SKIP_MEANS = 'Skip leaves a day as it is.'

export const BUSY_TEXT = 'Importing. The sheet stays open until it is done.'

export function daysWord(count: number): string {
  return count === 1 ? '1 day' : `${String(count)} days`
}

const ROWS: { key: keyof ImportCounts; label: string }[] = [
  { key: 'created', label: 'New' },
  { key: 'overwritten', label: 'Overwritten' },
  { key: 'merged', label: 'Merged' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'leftOut', label: 'Left out, with an error' },
]

export type ImportConfirmSheetProps = {
  open: boolean
  counts: ImportCounts
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function ImportConfirmSheet({
  open,
  counts,
  busy,
  error,
  onConfirm,
  onCancel,
}: ImportConfirmSheetProps) {
  const writes = counts.created + counts.overwritten + counts.merged
  const locked = busy || writes === 0

  return (
    <SheetModal
      open={open}
      title={CONFIRM_TITLE}
      closeDisabled={busy}
      onClose={() => {
        if (!busy) onCancel()
      }}
      footer={
        <div className="grid gap-2.5">
          <p role="status" className="text-muted text-center text-xs">
            {busy ? BUSY_TEXT : ''}
          </p>
          <PrimaryButton
            aria-disabled={locked}
            className="aria-disabled:opacity-50"
            onClick={() => {
              if (!locked) onConfirm()
            }}
          >
            {busy ? 'Importing…' : `Import ${daysWord(writes)}`}
          </PrimaryButton>
          <SecondaryButton disabled={busy} onClick={onCancel}>
            Cancel
          </SecondaryButton>
        </div>
      }
    >
      <p className="text-text text-sm">
        {`${daysWord(writes)} will be written to this device and queued to sync.`}
      </p>
      <dl className="border-border mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t pt-3 text-sm">
        {ROWS.map(({ key, label }) => (
          <div key={key} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-text m-0 text-right font-bold" data-testid={`confirm-${key}`}>
              {counts[key]}
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-border mt-3 border-t pt-3">
        <MicroLabel as="p">What the choices do</MicroLabel>
        <ul className="text-muted mt-1.5 flex list-none flex-col gap-1 p-0 text-[13px]">
          <li>{OVERWRITE_MEANS}</li>
          <li>{MERGE_MEANS}</li>
          <li>{SKIP_MEANS}</li>
        </ul>
      </div>
      {error === null ? null : (
        <p role="alert" className="text-danger mt-3 mb-2 text-sm">
          {error}
        </p>
      )}
    </SheetModal>
  )
}
