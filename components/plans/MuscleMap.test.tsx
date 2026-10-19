import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { colorTokens } from '../../lib/design/tokens'

import { MuscleMap, muscleLabel, regionHits, SECONDARY_OPACITY } from './MuscleMap'

function region(container: HTMLElement, side: 'front' | 'back', name: string) {
  const found = container.querySelector(`svg[data-side="${side}"] g[data-region="${name}"]`)
  if (found === null) throw new Error(`${side} ${name} is not drawn`)
  return found
}

function lit(container: HTMLElement, side: 'front' | 'back') {
  return [...container.querySelectorAll(`svg[data-side="${side}"] g:not([data-role="none"])`)].map(
    (group) => group.getAttribute('data-region'),
  )
}

function press(size: 'chip' | 'card' | 'frame' = 'frame') {
  return render(<MuscleMap primary={['chest']} secondary={['shoulders', 'triceps']} size={size} />)
}

describe('muscleLabel', () => {
  it('reads the main muscles and then the helpers, as the chips name them', () => {
    expect(muscleLabel(['chest'], ['shoulders', 'triceps'])).toBe(
      'Main: Chest. Helpers: Shoulders, Triceps.',
    )
  })

  it('leaves out the helper sentence when there are none', () => {
    expect(muscleLabel(['quadriceps', 'hamstrings'], [])).toBe('Main: Quadriceps, Hamstrings.')
  })

  it('capitalises only the first letter of a 2 word muscle', () => {
    expect(muscleLabel(['lats'], ['middle back'])).toBe('Main: Lats. Helpers: Middle back.')
  })
})

describe('regionHits', () => {
  it('keeps a region primary when a helper shares it', () => {
    const hits = regionHits(['lats'], ['middle back'])
    expect(hits.get('upper-back')).toEqual({ role: 'primary', fill: colorTokens['data-cyan'] })
  })

  it('keeps a region primary when the helper is listed after it', () => {
    const hits = regionHits(['middle back', 'lats'], ['lats'])
    expect(hits.get('upper-back')?.role).toBe('primary')
  })
})

describe('MuscleMap', () => {
  it('draws a front and a back figure', () => {
    const { container } = press()
    expect(container.querySelectorAll('svg[data-side="front"]')).toHaveLength(1)
    expect(container.querySelectorAll('svg[data-side="back"]')).toHaveLength(1)
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 100 200')
  })

  it('lights chest, the front and back deltoids and the triceps for Flat Dumbbell Press', () => {
    const { container } = press()
    expect(lit(container, 'front').sort()).toEqual(['chest', 'front-deltoids', 'triceps'])
    expect(lit(container, 'back').sort()).toEqual(['back-deltoids', 'triceps'])
  })

  it('fills a primary region solid in the group colour', () => {
    const { container } = press()
    const chest = region(container, 'front', 'chest')
    expect(chest).toHaveAttribute('fill', colorTokens.accent)
    expect(chest).toHaveAttribute('fill-opacity', '1')
    expect(chest).toHaveAttribute('data-role', 'primary')
  })

  it('fills a secondary region in the group colour at 55 percent', () => {
    const { container } = press()
    const deltoids = region(container, 'back', 'back-deltoids')
    expect(deltoids).toHaveAttribute('fill', colorTokens['data-blue'])
    expect(deltoids).toHaveAttribute('fill-opacity', String(SECONDARY_OPACITY))
    expect(region(container, 'front', 'triceps')).toHaveAttribute('fill', colorTokens['data-pink'])
  })

  it('fills every other region with surface 2 and a border stroke', () => {
    const { container } = press()
    const abs = region(container, 'front', 'abs')
    expect(abs).toHaveAttribute('fill', colorTokens['surface-2'])
    expect(abs).toHaveAttribute('stroke', colorTokens.border)
    expect(abs).toHaveAttribute('data-role', 'none')
  })

  it('names every muscle in its label', () => {
    press()
    expect(
      screen.getByRole('img', { name: 'Main: Chest. Helpers: Shoulders, Triceps.' }),
    ).toBeInTheDocument()
  })

  it('hides both figures from the accessibility tree', () => {
    const { container } = press()
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('draws the frame size as a 3 by 2 box with Front, Back and the key', () => {
    const { container } = press('frame')
    const root = screen.getByRole('img')
    expect(root.className).toContain('aspect-[3/2]')
    expect(root.className).toContain('w-full')
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('w-[min(31cqw,88px)]')
    expect(root).toHaveTextContent('Front')
    expect(root).toHaveTextContent('Back')
    expect(root).toHaveTextContent('main')
    expect(root).toHaveTextContent('helper')
  })

  it('draws the card size with 52 px figures', () => {
    const { container } = press('card')
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('w-[52px]')
    expect(screen.getByRole('img')).toHaveTextContent('Front')
  })

  it('draws the chip size with 26 px figures and no words', () => {
    const { container } = press('chip')
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('w-[26px]')
    expect(screen.getByRole('img').tagName).toBe('SPAN')
    expect(screen.getByRole('img')).toHaveTextContent('')
  })

  it('adds a class name from the caller', () => {
    render(<MuscleMap primary={['chest']} secondary={[]} size="chip" className="ml-auto" />)
    expect(screen.getByRole('img').className).toContain('ml-auto')
  })
})
