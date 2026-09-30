import { afterEach, describe, expect, it, vi } from 'vitest'

import { browserPlatform, createRestAlert, VIBRATE_PATTERN } from './restAlert'

function fakeAudio(play: () => Promise<void> = () => Promise.resolve()) {
  const audio = document.createElement('audio')
  const playSpy = vi.spyOn(audio, 'play').mockImplementation(play)
  const pauseSpy = vi.spyOn(audio, 'pause').mockImplementation(() => undefined)
  return { audio, playSpy, pauseSpy }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('createRestAlert', () => {
  it('vibrates and plays the beep at zero', () => {
    const { audio, playSpy } = fakeAudio()
    const vibrate = vi.fn(() => true)
    const createAudio = vi.fn<(source: string) => HTMLAudioElement>(() => audio)
    createRestAlert({ createAudio, vibrate }).ring(false)

    expect(vibrate).toHaveBeenCalledWith(VIBRATE_PATTERN)
    expect(playSpy).toHaveBeenCalledTimes(1)
    expect(createAudio.mock.calls[0]?.[0]).toMatch(/^data:audio\/wav;base64,/)
  })

  it('vibrates and plays no sound when the rest sound is muted', () => {
    const { audio, playSpy } = fakeAudio()
    const vibrate = vi.fn(() => true)
    createRestAlert({ createAudio: () => audio, vibrate }).ring(true)

    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(playSpy).not.toHaveBeenCalled()
  })

  it('plays the sound on a device with no vibration', () => {
    const { audio, playSpy } = fakeAudio()
    createRestAlert({ createAudio: () => audio, vibrate: undefined }).ring(false)

    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('unlocks the sound with a silent play that it stops at once', async () => {
    const { audio, playSpy, pauseSpy } = fakeAudio()
    const alert = createRestAlert({ createAudio: () => audio, vibrate: undefined })

    alert.unlock()
    expect(audio.muted).toBe(true)
    await vi.waitFor(() => {
      expect(pauseSpy).toHaveBeenCalledTimes(1)
    })
    expect(audio.muted).toBe(false)

    alert.unlock()
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('tries the unlock again after a refused play', async () => {
    const { audio, playSpy } = fakeAudio(() => Promise.reject(new Error('NotAllowedError')))
    const alert = createRestAlert({ createAudio: () => audio, vibrate: undefined })

    alert.unlock()
    await Promise.resolve()
    alert.unlock()

    expect(playSpy).toHaveBeenCalledTimes(2)
  })

  it('makes one sound element and reuses it', () => {
    const { audio } = fakeAudio()
    const createAudio = vi.fn(() => audio)
    const alert = createRestAlert({ createAudio, vibrate: undefined })

    alert.unlock()
    alert.ring(false)

    expect(createAudio).toHaveBeenCalledTimes(1)
  })

  it('survives a play that throws', () => {
    const { audio } = fakeAudio(() => {
      throw new Error('not implemented')
    })
    const alert = createRestAlert({ createAudio: () => audio, vibrate: undefined })

    expect(() => {
      alert.ring(false)
    }).not.toThrow()
  })

  it('survives a play that throws a value that is not an error', () => {
    const { audio } = fakeAudio(() => {
      throw 'not implemented' as unknown as Error
    })
    const alert = createRestAlert({ createAudio: () => audio, vibrate: undefined })

    expect(() => {
      alert.unlock()
    }).not.toThrow()
  })
})

describe('browserPlatform', () => {
  it('vibrates through navigator.vibrate when it exists', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })

    browserPlatform().vibrate?.([100])

    expect(vibrate).toHaveBeenCalledWith([100])
  })

  it('has no vibration where navigator.vibrate is missing, as on iOS Safari', () => {
    vi.stubGlobal('navigator', {})

    expect(browserPlatform().vibrate).toBeUndefined()
  })

  it('makes a real audio element for the sound', () => {
    expect(browserPlatform().createAudio('data:audio/wav;base64,')).toBeInstanceOf(HTMLAudioElement)
  })
})
