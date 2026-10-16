import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyText, reloadPage } from './browser'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reloadPage', () => {
  it('reloads the open page', () => {
    const reload = vi.fn()
    vi.stubGlobal('window', { location: { reload } })

    reloadPage()

    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('copyText', () => {
  it('writes the text to the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await copyText('boom')

    expect(writeText).toHaveBeenCalledWith('boom')
  })

  it('rejects when the browser has no clipboard', async () => {
    vi.stubGlobal('navigator', {})

    await expect(copyText('boom')).rejects.toThrow()
  })
})
