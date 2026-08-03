// Dependency-free PNG decoder/analyzer for sprite sheets.
// Prints: dimensions, non-transparent row bands, content bounding boxes, and
// horizontal frame boundaries (columns of non-transparent content).
// Usage: node scripts/png-sheet-info.mjs <file> [rowBand]   (rowBand 0-based)
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

function decodePng(path) {
  const buf = readFileSync(path)
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const bitDepth = buf[24]
  const colorType = buf[25]
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`Unsupported PNG: bitDepth=${bitDepth} colorType=${colorType} (need 8-bit RGBA)`)
  // Collect IDAT chunks
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

const file = process.argv[2]
const bandArg = process.argv[3]
const { width, height, rows } = decodePng(file)
console.log(`${file}: ${width}x${height}`)

// Row bands: contiguous rows with any non-transparent pixel.
const bands = []
let inBand = false
let start = 0
for (let y = 0; y < height; y += 1) {
  const row = rows[y]
  let opaque = false
  for (let x = 0; x < width; x += 1) { if (row[x * 4 + 3] > 0) { opaque = true; break } }
  if (opaque && !inBand) { inBand = true; start = y }
  if (!opaque && inBand) { inBand = false; bands.push([start, y - 1]) }
}
if (inBand) bands.push([start, height - 1])
console.log('non-transparent row bands:', bands.map(([a, b]) => `${a}..${b} (h=${b - a + 1})`).join(', ') || '(none)')

// For a chosen band, report content columns (frame boundaries) + per-column bbox.
const y0 = bandArg !== undefined ? Number(bandArg) : (bands[0] ? bands[0][0] : 0)
const y1 = bandArg !== undefined ? Number(bandArg) : (bands[0] ? bands[0][1] : height - 1)
const content = []
let inCol = false
for (let x = 0; x < width; x += 1) {
  let opaque = false
  for (let y = y0; y <= y1; y += 1) { if (rows[y][x * 4 + 3] > 0) { opaque = true; break } }
  if (opaque && !inCol) { inCol = true; content.push(x) }
  if (!opaque && inCol) { inCol = false; content.push(x - 1) }
}
if (inCol) content.push(width - 1)
const cols = []
for (let i = 0; i < content.length; i += 2) {
  const a = content[i]; const b = content[i + 1]
  let minY = y1, maxY = y0
  for (let x = a; x <= b; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      if (rows[y][x * 4 + 3] > 0) { if (y < minY) minY = y; if (y > maxY) maxY = y; break }
    }
  }
  cols.push({ x0: a, x1: b, w: b - a + 1, yTop: minY, yBottom: maxY })
}
console.log(`band ${y0}..${y1}: ${cols.length} content column(s):`)
for (const c of cols) console.log(`  x=${c.x0}..${c.x1} (w=${c.w}), content y=${c.yTop}..${c.yBottom}`)

// ASCII occupancy map: each char is a cell of cellW x cellH px (block = any non-transparent pixel).
const cellW = 32
const cellH = 64
console.log('\nASCII map (each char = 32x64px block, # = content):')
for (let cy = 0; cy * cellH < height; cy += 1) {
  let line = String(cy * cellH).padStart(4) + ' '
  for (let cx = 0; cx * cellW < width; cx += 1) {
    let hit = false
    outer:
    for (let y = cy * cellH; y < Math.min((cy + 1) * cellH, height); y += 1) {
      for (let x = cx * cellW; x < Math.min((cx + 1) * cellW, width); x += 1) {
        if (rows[y][x * 4 + 3] > 0) { hit = true; break outer }
      }
    }
    line += hit ? '#' : '.'
  }
  console.log(line)
}
