// Extracts the idle strip (row 1, y 0..63) and running strip (row 6, y 320..383)
// from each AllCats*.png atlas into public/assets/cats/<id>/idle.png + running.png
// (384x64, 6 frames x 64x64 — identical layout to the default cat), writes a
// per-cat manifest.json, and generates a preview HTML to eyeball the results.
// Usage: node scripts/extract-cats.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decodePng, cropRows, sampleOpaque, writePng } from './png-lib.mjs'

const SOURCE_DIR = join('public', 'assets', 'cats', 'default')
const OUT_DIR = join('public', 'assets', 'cats')

const cats = [
  // The black atlas is horizontally mirrored relative to the other cats (its
  // idle faces right / running faces left), so flip it to match the convention
  // (idle faces left, running faces right) used by the overlay code.
  { file: 'AllCatsBlack.png', id: 'black', displayName: 'Black Cat', flipX: true },
  { file: 'AllCatsGrey.png', id: 'grey', displayName: 'Grey Cat' },
  { file: 'AllCatsGreyWhite.png', id: 'grey-white', displayName: 'Grey & White Cat' },
  { file: 'AllCatsOrange.png', id: 'orange', displayName: 'Orange Cat' },
  { file: 'AllCatsWhite.png', id: 'white', displayName: 'White Cat' }
]

// Default idle/running layout (matches public/assets/cats/default/manifest.json).
const IDLE_ROW_Y = 0
const RUNNING_ROW_Y = 320
const STRIP_W = 384
const STRIP_H = 64

const previewRows = []
for (const cat of cats) {
  const source = join(SOURCE_DIR, cat.file)
  let image = decodePng(source)
  const idle = cropRows(image, 0, IDLE_ROW_Y, STRIP_W, STRIP_H)
  const running = cropRows(image, 0, RUNNING_ROW_Y, STRIP_W, STRIP_H)
  if (cat.flipX) {
    const flip = (strip) => ({
      width: strip.width,
      height: strip.height,
      rows: strip.rows.map((row) => {
        const copy = Buffer.from(row)
        for (let x = 0; x < strip.width; x += 1) {
          const src = x * 4
          const dst = (strip.width - 1 - x) * 4
          copy[dst] = row[src]; copy[dst + 1] = row[src + 1]; copy[dst + 2] = row[src + 2]; copy[dst + 3] = row[src + 3]
        }
        return copy
      })
    })
    idle.rows = flip(idle).rows
    running.rows = flip(running).rows
  }
  const dir = join(OUT_DIR, cat.id)
  mkdirSync(dir, { recursive: true })
  writePng(join(dir, 'idle.png'), idle)
  writePng(join(dir, 'running.png'), running)
  const manifest = {
    id: `cat-${cat.id}`,
    displayName: cat.displayName,
    animations: {
      idle: { src: 'idle.png', frameWidth: 64, frameHeight: 64, frameCount: 6, fps: 8, scale: 3, feetPaddingPx: 0, facing: 'left' },
      running: { src: 'running.png', frameWidth: 64, frameHeight: 64, frameCount: 6, fps: 10, scale: 3, feetPaddingPx: 5, facing: 'right' }
    }
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  // Sample inside the body (content starts around y=19), not above the head.
  const idleSample = sampleOpaque(idle, 4, 30, 8, 8)
  const runSample = sampleOpaque(running, 4, 30, 8, 8)
  console.log(`${cat.file} -> ${cat.id}/ (idle ${idle.width}x${idle.height}, running ${running.width}x${running.height})`
    + ` | idle sample rgb(${idleSample?.r},${idleSample?.g},${idleSample?.b}) running sample rgb(${runSample?.r},${runSample?.g},${runSample?.b})`)
  previewRows.push(`<h3>${cat.displayName} (${cat.id})</h3>
    <div class="row"><div class="cell"><b>idle</b><img src="./${cat.id}/idle.png" width="768" height="128"></div>
    <div class="cell"><b>running</b><img src="./${cat.id}/running.png" width="768" height="128"></div></div>`)
}

// Also show the default cat for comparison.
const defaultIdle = decodePng(join(SOURCE_DIR, 'idle.png'))
const defaultRun = decodePng(join(SOURCE_DIR, 'running.png'))
const dSample = sampleOpaque(defaultIdle, 4, 8, 8, 8)
console.log(`default/idle.png sample rgb(${dSample?.r},${dSample?.g},${dSample?.b}) (for naming/dup check)`)

const preview = `<!doctype html><html><head><meta charset="utf-8"><title>Cat preview</title>
<style>body{background:#1e1e28;color:#eee;font-family:monospace;padding:16px}
.cell{display:inline-block;margin:0 16px 16px 0}img{image-rendering:pixelated;border:2px solid #444;border-radius:4px;display:block;margin-top:4px}
h3{margin:12px 0 4px}hr{border-color:#333}</style></head><body><h1>Extracted cat strips</h1>${previewRows.join('<hr>')}</body></html>`
// Preview goes to the OS temp dir (NOT public/) so it never ships in the app.
const previewPath = join(tmpdir(), 'cat-reminder-cat-preview.html')
writeFileSync(previewPath, preview)
console.log(`preview written to ${previewPath} (open in a browser to eyeball)`)
