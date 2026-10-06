import { afterEach, describe, expect, it, vi } from 'vitest'

import { ForcedCrash } from '../../../components/errors/ForcedCrash'

import CrashTestPage from './page'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the crash test route', () => {
  it('is not found when the flag is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CRASH_TEST', '')

    expect(() => CrashTestPage()).toThrow('NEXT_NOT_FOUND')
  })

  it('renders the forced crash when the flag is on', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CRASH_TEST', '1')

    expect(CrashTestPage()).toEqual(<ForcedCrash />)
  })
})
