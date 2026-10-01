'use client'

import { formatDuration } from '../../lib/duration'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SheetModal } from '../ui/SheetModal'

import type { GymTimeOffer } from '../../lib/workout/gymTime'

export const GYM_TIME_SAVE_FAILED = 'The gym time could not be saved on this device.'

export const OFFER_REGION = 'Gym time from the session'

export const FINISHED_TITLE = 'Session finished'

const PILL =
  'bg-surface-2 border-border text-accent inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 text-[13px] font-bold whitespace-nowrap disabled:opacity-50'

function clock(seconds: number): string {
  return formatDuration(seconds, 'clock')
}

export function acceptLabel(offer: GymTimeOffer): string {
  return `Use ${clock(offer.sessionSeconds)} for gym time`
}

export function keepLabel(offer: GymTimeOffer): string {
  return offer.loggedSeconds === null ? 'Not now' : `Keep ${clock(offer.loggedSeconds)}`
}

function InfoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className="text-accent shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  )
}

export type GymTimeOfferCardProps = {
  offer: GymTimeOffer
  dateLabel: string
  isToday: boolean
  busy?: boolean
  onUse: () => void
  className?: string
}

export function GymTimeOfferCard({
  offer,
  dateLabel,
  isToday,
  busy = false,
  onUse,
  className,
}: GymTimeOfferCardProps) {
  return (
    <Card
      role="region"
      aria-label={OFFER_REGION}
      className={cn('flex items-center gap-3', className)}
    >
      <InfoIcon />
      <p className="text-muted min-w-0 flex-1 text-[13px]">
        {isToday ? "Today's session was " : `The session on ${dateLabel} was `}
        <strong className="text-text">{clock(offer.sessionSeconds)}</strong>
        {'. '}
        {offer.loggedSeconds === null ? (
          'Your log has no gym time.'
        ) : (
          <>
            {'Your log says '}
            <strong className="text-text">{clock(offer.loggedSeconds)}</strong>
            {'.'}
          </>
        )}
        {' Use the session for gym time?'}
      </p>
      <button type="button" disabled={busy} onClick={onUse} className={PILL}>
        Use <span className="sr-only">{`${clock(offer.sessionSeconds)} for gym time`}</span>
      </button>
    </Card>
  )
}

export type GymTimeSheetProps = {
  offer: GymTimeOffer | null
  dateLabel: string
  summary: string
  busy?: boolean
  error?: string | null
  onUse: () => void
  onKeep: () => void
}

export function GymTimeSheet({
  offer,
  dateLabel,
  summary,
  busy = false,
  error = null,
  onUse,
  onKeep,
}: GymTimeSheetProps) {
  return (
    <SheetModal open={offer !== null} title={FINISHED_TITLE} onClose={onKeep}>
      {offer === null ? null : (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-text text-[48px] leading-none font-extrabold tracking-[-2.4px]">
              {clock(offer.sessionSeconds)}
            </p>
            <p className="text-muted mt-1 text-[13px]">{summary}</p>
          </div>

          <Card>
            <h3>
              <MicroLabel>{`Gym time for ${dateLabel}`}</MicroLabel>
            </h3>
            {offer.loggedSeconds === null ? (
              <p className="text-text mt-1.5 text-sm">
                {`Save ${clock(offer.sessionSeconds)} as gym time for ${dateLabel}?`}
              </p>
            ) : (
              <>
                <ul className="mt-1.5">
                  <li className="flex min-h-11 items-center justify-between gap-3">
                    <span className="text-muted text-[13px]">In your log</span>
                    <strong className="text-text">{clock(offer.loggedSeconds)}</strong>
                  </li>
                  <li className="flex min-h-11 items-center justify-between gap-3">
                    <span className="text-muted text-[13px]">This session</span>
                    <strong className="text-accent">{clock(offer.sessionSeconds)}</strong>
                  </li>
                </ul>
                <p className="text-muted mt-1.5 text-xs">
                  Your log already holds a different gym time. Nothing changes until you pick.
                </p>
              </>
            )}
          </Card>

          {error === null ? null : (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}

          <PrimaryButton disabled={busy} onClick={onUse}>
            {acceptLabel(offer)}
          </PrimaryButton>
          <SecondaryButton disabled={busy} onClick={onKeep}>
            {keepLabel(offer)}
          </SecondaryButton>
        </div>
      )}
    </SheetModal>
  )
}
