'use client'

import { SecondaryButton } from '../ui/SecondaryButton'
import { SheetModal } from '../ui/SheetModal'

export type SignOutSheetProps = {
  lost: number | null
  onConfirm: () => void
  onCancel: () => void
}

export function writesWord(count: number): string {
  return count === 1 ? '1 write' : `${String(count)} writes`
}

export function SignOutSheet({ lost, onConfirm, onCancel }: SignOutSheetProps) {
  const count = lost ?? 0

  return (
    <SheetModal open={lost !== null} title="Sign out with unsynced writes?" onClose={onCancel}>
      <p className="text-text text-sm">
        {`${writesWord(count)} ${count === 1 ? 'has' : 'have'} not reached the server. Signing out deletes ${count === 1 ? 'it' : 'them'} from this device for good.`}
      </p>
      <div className="mt-4 grid gap-2.5">
        <SecondaryButton tone="danger" onClick={onConfirm}>
          {`Sign out and lose ${writesWord(count)}`}
        </SecondaryButton>
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
      </div>
    </SheetModal>
  )
}
