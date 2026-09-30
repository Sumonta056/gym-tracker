import { beepDataUri } from '../../lib/workout/beep'

export const VIBRATE_PATTERN = [200, 100, 200]

export type RestAlert = {
  unlock: () => void
  ring: (muted: boolean) => void
}

type AlertPlatform = {
  createAudio: (source: string) => HTMLAudioElement
  vibrate: ((pattern: number[]) => boolean) | undefined
}

function ignore(): void {
  return undefined
}

function play(audio: HTMLAudioElement): Promise<void> {
  try {
    return Promise.resolve(audio.play())
  } catch (cause) {
    return Promise.reject(cause instanceof Error ? cause : new Error('play failed'))
  }
}

export function browserPlatform(): AlertPlatform {
  const vibrate =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
      ? (pattern: number[]) => navigator.vibrate(pattern)
      : undefined

  return { createAudio: (source) => new Audio(source), vibrate }
}

export function createRestAlert(platform: AlertPlatform = browserPlatform()): RestAlert {
  let audio: HTMLAudioElement | null = null
  let unlocked = false

  const element = () => {
    audio ??= platform.createAudio(beepDataUri())
    return audio
  }

  return {
    unlock() {
      if (unlocked) {
        return
      }

      const sound = element()

      sound.muted = true
      void play(sound).then(() => {
        unlocked = true
        sound.pause()
        sound.currentTime = 0
        sound.muted = false
      }, ignore)
    },
    ring(muted) {
      platform.vibrate?.(VIBRATE_PATTERN)

      if (muted) {
        return
      }

      const sound = element()

      sound.muted = false
      sound.currentTime = 0
      void play(sound).catch(ignore)
    },
  }
}
