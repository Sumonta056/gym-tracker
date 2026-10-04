export type ZipFile = { name: string; text: string }

const UTF8_NAMES = 0x0800
const VERSION = 20
const LOCAL_HEADER = 30
const CENTRAL_HEADER = 46
const END_RECORD = 22

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc ^= byte

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function dosTime(when: Date): number {
  return (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2)
}

function dosDate(when: Date): number {
  return ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()
}

export function zipFiles(files: ZipFile[], when: Date): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const time = dosTime(when)
  const date = dosDate(when)
  const items = files.map((file) => {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.text)

    return { name, data, crc: crc32(data), offset: 0 }
  })

  const localSize = items.reduce(
    (total, item) => total + LOCAL_HEADER + item.name.length + item.data.length,
    0,
  )
  const centralSize = items.reduce((total, item) => total + CENTRAL_HEADER + item.name.length, 0)
  const bytes = new Uint8Array(localSize + centralSize + END_RECORD)
  const view = new DataView(bytes.buffer)
  let cursor = 0

  for (const item of items) {
    item.offset = cursor
    view.setUint32(cursor, 0x04034b50, true)
    view.setUint16(cursor + 4, VERSION, true)
    view.setUint16(cursor + 6, UTF8_NAMES, true)
    view.setUint16(cursor + 8, 0, true)
    view.setUint16(cursor + 10, time, true)
    view.setUint16(cursor + 12, date, true)
    view.setUint32(cursor + 14, item.crc, true)
    view.setUint32(cursor + 18, item.data.length, true)
    view.setUint32(cursor + 22, item.data.length, true)
    view.setUint16(cursor + 26, item.name.length, true)
    view.setUint16(cursor + 28, 0, true)
    bytes.set(item.name, cursor + LOCAL_HEADER)
    bytes.set(item.data, cursor + LOCAL_HEADER + item.name.length)
    cursor += LOCAL_HEADER + item.name.length + item.data.length
  }

  for (const item of items) {
    view.setUint32(cursor, 0x02014b50, true)
    view.setUint16(cursor + 4, VERSION, true)
    view.setUint16(cursor + 6, VERSION, true)
    view.setUint16(cursor + 8, UTF8_NAMES, true)
    view.setUint16(cursor + 10, 0, true)
    view.setUint16(cursor + 12, time, true)
    view.setUint16(cursor + 14, date, true)
    view.setUint32(cursor + 16, item.crc, true)
    view.setUint32(cursor + 20, item.data.length, true)
    view.setUint32(cursor + 24, item.data.length, true)
    view.setUint16(cursor + 28, item.name.length, true)
    view.setUint32(cursor + 42, item.offset, true)
    bytes.set(item.name, cursor + CENTRAL_HEADER)
    cursor += CENTRAL_HEADER + item.name.length
  }

  view.setUint32(cursor, 0x06054b50, true)
  view.setUint16(cursor + 8, items.length, true)
  view.setUint16(cursor + 10, items.length, true)
  view.setUint32(cursor + 12, centralSize, true)
  view.setUint32(cursor + 16, localSize, true)

  return bytes
}
