'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

import { prefersReducedMotion } from '../motion/reducedMotion'
import { cn } from '../ui/cn'

import { MuscleMap } from './MuscleMap'

import type { PlanStep } from '../../lib/schema/plan'

export type FrameView = 'howto' | 'muscles'

export const PLAY_HALF_MS = 1200

export const START_CAPTION = '1 · Start'

export const END_CAPTION = '2 · End'

const VIEWS: { view: FrameView; label: string }[] = [
  { view: 'howto', label: 'How to' },
  { view: 'muscles', label: 'Muscles' },
]

const CAPTION =
  'pointer-events-none absolute top-6 left-6 rounded-full px-[9px] py-[3px] text-[11px] font-bold'

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
  const [view, setView] = useState<FrameView>('howto')
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const [still] = useState(prefersReducedMotion)
  const phase = usePlay(view === 'howto', still, paused)
  const showsEnd = phase === 'end'
  const caption = showsEnd ? END_CAPTION : START_CAPTION
  const fail = () => {
    setFailed(true)
  }

  return (
    <figure
      data-view={view}
      className={cn('bg-surface-2 relative m-0 aspect-[16/9] overflow-hidden', className)}
    >
      {view === 'muscles' ? (
        <MuscleMap primary={step.muscles.primary} secondary={step.muscles.secondary} size="frame" />
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
          {still ? null : (
            <button
              type="button"
              aria-pressed={paused}
              aria-label="Pause the movement"
              onClick={() => {
                setPaused((held) => !held)
              }}
              className="absolute inset-0 size-full focus-visible:outline-offset-[-4px]"
            />
          )}
          <figcaption
            className={cn(CAPTION, showsEnd ? 'bg-accent text-accent-ink' : 'bg-ground text-text')}
          >
            {caption}
          </figcaption>
        </>
      )}
      <div
        role="group"
        aria-label="Image view"
        className="bg-ground/85 absolute bottom-2 left-6 flex gap-1 rounded-xl p-[3px]"
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
              'min-h-11 rounded-[9px] px-2.5 text-[13px] font-bold',
              view === item.view ? 'bg-accent text-accent-ink' : 'text-text',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </figure>
  )
}
