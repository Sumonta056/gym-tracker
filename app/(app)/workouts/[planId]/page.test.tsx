import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { previewLine } from '../../../../components/plans/planText'
import { getPlan, listPlans, planSteps } from '../../../../lib/plans'

import PlanPreviewPage, { dynamicParams, generateMetadata, generateStaticParams } from './page'

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
)

vi.mock('next/navigation', () => ({
  notFound,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/workouts/chest-triceps',
}))

vi.mock('../../../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a page test')
  },
}))

function chestTriceps() {
  const plan = getPlan('chest-triceps')
  if (plan === undefined) throw new Error('expected the plan chest-triceps')
  return plan
}

function params(planId: string) {
  return { params: Promise.resolve({ planId }) }
}

describe('PlanPreviewPage', () => {
  it('builds every listed coach plan at build time and no other id', () => {
    expect(generateStaticParams()).toEqual(listPlans().map((plan) => ({ planId: plan.id })))
    expect(dynamicParams).toBe(false)
  })

  it('names the plan as its heading with the counts', async () => {
    render(await PlanPreviewPage(params('chest-triceps')))

    expect(screen.getByRole('heading', { level: 1, name: 'Chest + Triceps' })).toBeInTheDocument()
    expect(screen.getByText(previewLine(chestTriceps()))).toBeInTheDocument()
  })

  it('links back to the plans', async () => {
    render(await PlanPreviewPage(params('chest-triceps')))
    const back = screen.getByRole('link', { name: 'Plans' })

    expect(back).toHaveAttribute('href', '/workouts')
    expect(back).toHaveClass('min-h-11')
  })

  it('lists every step of the plan', async () => {
    render(await PlanPreviewPage(params('chest-triceps')))

    expect(screen.getAllByRole('listitem')).toHaveLength(planSteps(chestTriceps()).length)
  })

  it('offers Start for the plan at the foot', async () => {
    render(await PlanPreviewPage(params('chest-triceps')))

    expect(screen.getByRole('button', { name: 'Start Chest + Triceps' })).toBeEnabled()
  })

  it('returns the 404 page for an unknown id', async () => {
    await expect(PlanPreviewPage(params('nope'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('titles the page with the plan', async () => {
    expect(await generateMetadata(params('legs'))).toEqual({ title: 'Legs — Gym Tracker' })
  })

  it('falls back to the app title for an unknown id', async () => {
    expect(await generateMetadata(params('nope'))).toEqual({ title: 'Gym Tracker' })
  })
})
