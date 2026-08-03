// Dependency-free PNG decode/encode (8-bit RGBA) for sprite tooling.
import { inflateSync, deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'

export function decodePng(path) {
  const buf = readFileSync(path)
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const bitDepth = buf[24]
  const colorType = buf[25]
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`Unsupported PNG: bitDepth=${bitDepth} colorType=${colorType} (need 8-bit RGBA)`)
  let data = Buffer.alloc(0)
  let offset = 8
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') data = Buffer.concat([data, buf.subarray(offset + 8, offset + 8 + len)])
    offset += 12 + len
  }
  const raw = inflateSync(data)
  const stride = width * 4
  const bpp = 4
  const rows = []
  let pos = 0
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos]; pos += 1
    const line = Buffer.from(raw.subarray(pos, pos + stride)); pos += stride
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? line[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let value = line[x]
      if (filter === 1) value = (value + a) & 0xff
      else if (filter === 2) value = (value + b) & 0xff
      else if (filter === 3) value = (value + Math.floor((a + b) / 2)) & 0xff
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c)
        const pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
        value = (value + pred) & 0xff
      }
      line[x] = value
    }
    rows.push(line)
    prev = line
  }
  return { width, height, rows }
}

export function cropRows(src, x0, y0, width, height) {
  const out = []
  for (let y = 0; y < height; y += 1) {
    out.push(Buffer.from(src.rows[y0 + y].subarray(x0 * 4, (x0 + width) * 4)))
  }
  return { width, height, rows: out }
}

export function encodePng({ width, height, rows }) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  let pos = 0
  for (let y = 0; y < height; y += 1) {
    raw[pos] = 0 // filter: None
    pos += 1
    rows[y].copy(raw, pos)
    pos += stride
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const idat = deflateSync(raw, { level: 9 })
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length)
    out.writeUInt32BE(data.length, 0)
    out.write(type, 4, 'ascii')
    data.copy(out, 8)
    let crc = 0xffffffff
    const crcTable = []
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c
    }
    for (let i = 0; i < type.length + data.length; i += 1) {
      const byte = i < type.length ? type.charCodeAt(i) : data[i - type.length]
      crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    }
    out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length)
    return out
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

export function writePng(path, image) {
  writeFileSync(path, encodePng(image))
}

/** First non-transparent pixel color of a region (for palette sanity checks). */
export function sampleOpaque(image, x0, y0, width, height) {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      // rows[y] is the per-row buffer, so the index is local to the row.
      const i = x * 4
      if (image.rows[y][i + 3] > 0) {
        return { x, y, r: image.rows[y][i], g: image.rows[y][i + 1], b: image.rows[y][i + 2] }
      }
    }
  }
  return null
}
