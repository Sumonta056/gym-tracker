'use client'

import { useState } from 'react'

import { SheetModal } from '../ui/SheetModal'

import { zoneList, zoneNote } from './HeartRateZonesCard'

import type { MaxHeartRate, ZoneName } from '../../lib/metrics/heartRateZones'

export const ZONE_INFO_LABEL = 'What the zones mean'

export const ZONE_SHEET_TITLE = 'Heart rate zones'

export const ZONE_MEANING: Record<ZoneName, string> = {
  warm: 'Easy movement below 60 % of your max, such as a warm-up or the rest between sets.',
  fatBurn: 'A steady effort from 60 to 70 % of your max that you could keep up for a long time.',
  cardio: 'Hard work from 70 to 85 % of your max that builds your heart and lung fitness.',
  peak: 'An all-out effort above 85 % of your max that you can hold only for short bursts.',
}

export const SPREAD_EXPLAINED =
  'The app spreads your gym time between your average and your peak heart rate, so the split is a model, not a measurement.'

export const MAX_EXPLAINED =
  'Your max heart rate is the value you set in Profile. Without one, it is 220 minus your age, from your birth year.'

const NO_TIME = { warmSeconds: 0, fatBurnSeconds: 0, cardioSeconds: 0, peakSeconds: 0 }

export function ZoneInfoButton({ maxHeartRate }: { maxHeartRate: MaxHeartRate | null }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label={ZONE_INFO_LABEL}
        onClick={() => {
          setOpen(true)
        }}
        className="text-muted bg-surface-2 border-border inline-flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-bold"
      >
        <span aria-hidden="true">i</span>
      </button>
      <SheetModal
        open={open}
        title={ZONE_SHEET_TITLE}
        onClose={() => {
          setOpen(false)
        }}
      >
        <div className="flex flex-col gap-3">
          <dl className="flex flex-col gap-3">
            {zoneList(NO_TIME, maxHeartRate).map((zone) => (
              <div key={zone.zone} className="flex flex-col gap-0.5">
                <dt className="text-text text-[15px] font-bold">
                  {zone.band === null ? zone.name : `${zone.name}, ${zone.band}`}
                </dt>
                <dd className="text-muted text-sm">{ZONE_MEANING[zone.zone]}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted text-sm">{SPREAD_EXPLAINED}</p>
          <p className="text-muted text-sm">{MAX_EXPLAINED}</p>
          <p className="text-text text-sm">{zoneNote(maxHeartRate)}</p>
        </div>
      </SheetModal>
    </>
  )
}
