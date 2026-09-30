export const BEEP_SAMPLE_RATE = 8000

export const BEEP_SECONDS = 0.3

const BEEP_HERTZ = 880
const HEADER_BYTES = 44
const SILENCE = 128
const LOUDNESS = 100

function writeText(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

export function beepWav(): Uint8Array {
  const samples = Math.round(BEEP_SAMPLE_RATE * BEEP_SECONDS)
  const bytes = new Uint8Array(HEADER_BYTES + samples)
  const view = new DataView(bytes.buffer)

  writeText(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  writeText(view, 8, 'WAVE')
  writeText(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, BEEP_SAMPLE_RATE, true)
  view.setUint32(28, BEEP_SAMPLE_RATE, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeText(view, 36, 'data')
  view.setUint32(40, samples, true)

  for (let index = 0; index < samples; index += 1) {
    const envelope = Math.sin((Math.PI * index) / (samples - 1))
    const wave = Math.sin((2 * Math.PI * BEEP_HERTZ * index) / BEEP_SAMPLE_RATE)

    bytes[HEADER_BYTES + index] = Math.round(SILENCE + LOUDNESS * envelope * wave)
  }

  return bytes
}

export function beepDataUri(): string {
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...beepWav()))}`
}
