import { describe, expect, it } from 'vitest'

import { readResult, resultPath, resultText } from './importResult'

const OUTCOME = { created: 12, overwritten: 1, merged: 2, skipped: 1, leftOut: 3 }

describe('resultPath', () => {
  it('points at the dashboard with the five counts', () => {
    expect(resultPath(OUTCOME)).toBe('/?imported=12.1.2.1.3')
  })
})

describe('readResult', () => {
  it('reads back the counts that resultPath wrote', () => {
    expect(readResult(resultPath(OUTCOME).slice(1))).toEqual(OUTCOME)
  })

  it('returns null when the search holds no import result', () => {
    expect(readResult('')).toBeNull()
    expect(readResult('?other=1')).toBeNull()
  })

  it.each([
    '?imported=1.2.3.4',
    '?imported=1.2.3.4.x',
    '?imported=-1.0.0.0.0',
    '?imported=1.2.3.4.5.6',
  ])('returns null for the malformed value %s', (search) => {
    expect(readResult(search)).toBeNull()
  })
})

describe('resultText', () => {
  it('states every count as text, the same five the confirm sheet shows', () => {
    expect(resultText(OUTCOME)).toBe(
      'The sheet is imported: 12 new, 1 overwritten, 2 merged, 1 skipped, 3 left out.',
    )
  })

  it('keeps a zero count, as the confirm sheet does', () => {
    expect(resultText({ created: 16, overwritten: 0, merged: 0, skipped: 0, leftOut: 0 })).toBe(
      'The sheet is imported: 16 new, 0 overwritten, 0 merged, 0 skipped, 0 left out.',
    )
  })
})
