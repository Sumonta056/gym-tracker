import { describe, expect, it } from 'vitest'

import { crc32, zipFiles } from './zip'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

type Entry = { name: string; crc: number; data: string; method: number; flags: number }

function readZip(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.byteLength - 22

  expect(view.getUint32(end, true)).toBe(0x06054b50)

  const count = view.getUint16(end + 10, true)
  let cursor = view.getUint32(end + 16, true)
  const entries: Entry[] = []

  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50)
    const flags = view.getUint16(cursor + 8, true)
    const method = view.getUint16(cursor + 10, true)
    const crc = view.getUint32(cursor + 16, true)
    const size = view.getUint32(cursor + 20, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const local = view.getUint32(cursor + 42, true)
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))

    expect(view.getUint32(local, true)).toBe(0x04034b50)
    expect(view.getUint32(local + 14, true)).toBe(crc)
    const localName = view.getUint16(local + 26, true)
    const extra = view.getUint16(local + 28, true)
    const start = local + 30 + localName + extra
    const data = decoder.decode(bytes.subarray(start, start + size))

    entries.push({ name, crc, data, method, flags })
    cursor += 46 + nameLength
  }

  return entries
}

describe('crc32', () => {
  it('matches the standard check value for 123456789', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926)
  })

  it('returns 0 for no bytes', () => {
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('zipFiles', () => {
  const when = new Date(2026, 9, 4, 17, 30, 12)

  it('stores every file under its name with its exact text', () => {
    const entries = readZip(
      zipFiles(
        [
          { name: 'a.csv', text: 'id\n1\n' },
          { name: 'b.csv', text: 'note\n"Café, ok"\n' },
        ],
        when,
      ),
    )

    expect(entries.map(({ name, data }) => ({ name, data }))).toEqual([
      { name: 'a.csv', data: 'id\n1\n' },
      { name: 'b.csv', data: 'note\n"Café, ok"\n' },
    ])
  })

  it('stores without compression and marks the names as UTF-8', () => {
    const [entry] = readZip(zipFiles([{ name: 'a.csv', text: 'x' }], when))

    expect(entry?.method).toBe(0)
    expect(entry?.flags).toBe(0x0800)
  })

  it('records the crc of each file', () => {
    const [entry] = readZip(zipFiles([{ name: 'a.csv', text: '123456789' }], when))

    expect(entry?.crc).toBe(0xcbf43926)
  })

  it('writes the local time as the modified date', () => {
    const bytes = zipFiles([{ name: 'a.csv', text: 'x' }], when)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

    expect(view.getUint16(10, true)).toBe((17 << 11) | (30 << 5) | 6)
    expect(view.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 4)
  })

  it('writes an empty archive when there is nothing to store', () => {
    const bytes = zipFiles([], when)

    expect(bytes.byteLength).toBe(22)
    expect(readZip(bytes)).toEqual([])
  })
})
