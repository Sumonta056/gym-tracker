import { SyncChipView } from '../sync/SyncChip'

import type { SyncStatusReport } from '../../lib/db/repository'

export type ProfileHeaderProps = {
  email: string | null
  report: SyncStatusReport
}

export function ProfileHeader({ email, report }: ProfileHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]">Profile</h1>
        {email === null ? null : <p className="text-muted text-[13px] break-all">{email}</p>}
      </div>
      <SyncChipView report={report} className="shrink-0" />
    </header>
  )
}
