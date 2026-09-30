import { describe, expect, it } from 'vitest'

import { BEEP_SAMPLE_RATE, BEEP_SECONDS, beepDataUri, beepWav } from './beep'

function text(bytes: Uint8Array, from: number, length: number): string {
  return String.fromCharCode(...bytes.slice(from, from + length))
}

describe('beepWav', () => {
  const bytes = beepWav()
  const view = new DataView(bytes.buffer)
  const samples = Math.round(BEEP_SAMPLE_RATE * BEEP_SECONDS)

  it('writes a RIFF WAVE header', () => {
    expect(text(bytes, 0, 4)).toBe('RIFF')
    expect(text(bytes, 8, 4)).toBe('WAVE')
    expect(text(bytes, 12, 4)).toBe('fmt ')
    expect(text(bytes, 36, 4)).toBe('data')
  })

  it('declares mono 8-bit sound at the beep sample rate', () => {
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(BEEP_SAMPLE_RATE)
    expect(view.getUint16(34, true)).toBe(8)
  })

  it('holds one byte per sample after the 44 byte header', () => {
    expect(bytes.length).toBe(44 + samples)
    expect(view.getUint32(40, true)).toBe(samples)
    expect(view.getUint32(4, true)).toBe(36 + samples)
  })

  it('starts and ends in silence so the beep does not click', () => {
    expect(bytes[44]).toBe(128)
    expect(bytes.at(-1)).toBe(128)
  })

  it('carries a tone in the middle', () => {
    const middle = Array.from(bytes.slice(44 + samples / 2 - 20, 44 + samples / 2 + 20))
    expect(Math.max(...middle) - Math.min(...middle)).toBeGreaterThan(100)
  })
})

describe('beepDataUri', () => {
  it('encodes the beep as a base64 WAV data URI', () => {
    const uri = beepDataUri()
    expect(uri.startsWith('data:audio/wav;base64,')).toBe(true)
    expect(atob(uri.slice('data:audio/wav;base64,'.length)).slice(0, 4)).toBe('RIFF')
  })
})
