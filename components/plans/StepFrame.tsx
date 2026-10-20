'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

import { prefersReducedMotion } from '../motion/reducedMotion'
import { cn } from '../ui/cn'

import { MuscleMap } from './MuscleMap'

import type { PlanStep } from '../../lib/schema/plan'

export type FrameView = 'start' | 'end' | 'play' | 'muscles'

export const PLAY_HALF_MS = 1200

export const START_CAPTION = '1 · Start'

export const END_CAPTION = '2 · End'

const VIEWS: { view: FrameView; label: string; glyph?: string }[] = [
  { view: 'start', label: 'Start' },
  { view: 'end', label: 'End' },
  { view: 'play', label: 'Play', glyph: '▶' },
  { view: 'muscles', label: 'Muscles' },
]

const CAPTION =
  'pointer-events-none absolute top-2 left-2 rounded-full px-[9px] py-[3px] text-[11px] font-bold'

export function startAlt(name: string): string {
  return `${name}, start position`
}

export function endAlt(name: string): string {
  return `${name}, end position`
}

export type StepFrameProps = {
  step: Pick<PlanStep, 'name' | 'images' | 'muscles'>
  className?: string
}

type Phase = 'start' | 'end'

function usePlay(active: boolean, still: boolean, paused: boolean): Phase {
  const [phase, setPhase] = useState<Phase>('start')

  useEffect(() => {
    if (!active || still || paused) {
      return
    }

    const timer = setInterval(() => {
      setPhase((held) => (held === 'start' ? 'end' : 'start'))
    }, PLAY_HALF_MS)

    return () => {
      clearInterval(timer)
    }
  }, [active, still, paused])

  return still ? 'end' : phase
}

function FrameImage({
  src,
  alt,
  shown,
  onError,
}: {
  src: string
  alt: string
  shown: boolean
  onError: () => void
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="(min-width: 1024px) 640px, 100vw"
      onError={onError}
      data-shown={shown}
      className={cn(
        'object-cover motion-safe:transition-opacity motion-safe:duration-500',
        shown ? 'opacity-100' : 'opacity-0',
      )}
    />
  )
}

export function StepFrame({ step, className }: StepFrameProps) {
  const [view, setView] = useState<FrameView>('play')
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const [still] = useState(prefersReducedMotion)
  const phase = usePlay(view === 'play', still, paused)
  const showsEnd = view === 'end' || (view === 'play' && phase === 'end')
  const caption = showsEnd ? END_CAPTION : START_CAPTION
  const fail = () => {
    setFailed(true)
  }

  return (
    <div className={className}>
      <figure
        data-view={view}
        className="bg-surface-2 relative m-0 aspect-[3/2] w-full overflow-hidden rounded-[14px]"
      >
        {view === 'muscles' ? (
          <>
            <MuscleMap
              primary={step.muscles.primary}
              secondary={step.muscles.secondary}
              size="frame"
            />
            <figcaption className={cn(CAPTION, 'bg-ground text-text')}>Muscles</figcaption>
          </>
        ) : failed ? (
          <p
            data-testid="frame-failed"
            className="text-muted absolute inset-0 grid place-items-center p-4 text-center text-sm font-bold"
          >
            {step.name}
          </p>
        ) : (
          <>
            <FrameImage
              src={step.images.start}
              alt={startAlt(step.name)}
              shown={!showsEnd}
              onError={fail}
            />
            <FrameImage
              src={step.images.end}
              alt={endAlt(step.name)}
              shown={showsEnd}
              onError={fail}
            />
            {view === 'play' && !still ? (
              <button
                type="button"
                aria-pressed={paused}
                aria-label="Pause the movement"
                onClick={() => {
                  setPaused((held) => !held)
                }}
                className="absolute inset-0 size-full focus-visible:outline-offset-[-4px]"
              />
            ) : null}
            <figcaption
              className={cn(
                CAPTION,
                showsEnd ? 'bg-accent text-accent-ink' : 'bg-ground text-text',
              )}
            >
              {caption}
            </figcaption>
          </>
        )}
      </figure>
      <div
        role="group"
        aria-label="Image view"
        className="bg-surface-2 mt-2 grid grid-cols-4 gap-1 rounded-xl p-1"
      >
        {VIEWS.map((item) => (
          <button
            key={item.view}
            type="button"
            aria-pressed={view === item.view}
            onClick={() => {
              setView(item.view)
              setPaused(false)
            }}
            className={cn(
              'min-h-10 min-w-0 rounded-[9px] px-1 text-[13px] font-bold',
              view === item.view ? 'bg-surface text-text' : 'text-muted',
            )}
          >
            {item.glyph === undefined ? null : <span aria-hidden="true">{`${item.glyph} `}</span>}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
