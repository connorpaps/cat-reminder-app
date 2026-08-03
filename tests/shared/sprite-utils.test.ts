import { describe, expect, it } from 'vitest'
// The sprite utility is a small dependency-free ESM module used by the extractor.
// @ts-expect-error The repository does not ship TypeScript declarations for .mjs tooling modules.
import { flipStripFrames } from '../../scripts/sprite-utils.mjs'
// @ts-expect-error The repository does not ship TypeScript declarations for .mjs tooling modules.
import { decodePng } from '../../scripts/png-lib.mjs'

describe('sprite extraction transforms', () => {
  it('keeps the black idle icon in the same orientation as the source cat', () => {
    const source = decodePng('public/assets/cats/default/AllCatsBlack.png')
    const generated = decodePng('public/assets/cats/black/idle.png')
    for (const frame of [0, 1, 2, 3, 4, 5]) {
      let sourceMinX = 64
      let generatedMinX = 64
      for (let y = 0; y < 64; y += 1) {
        for (let x = 0; x < 64; x += 1) {
          if (source.rows[y][(frame * 64 + x) * 4 + 3] > 0) sourceMinX = Math.min(sourceMinX, x)
          if (generated.rows[y][(frame * 64 + x) * 4 + 3] > 0) generatedMinX = Math.min(generatedMinX, x)
        }
      }
      expect(generatedMinX).toBe(sourceMinX)
    }
  })

  it('mirrors pixels inside each frame without reversing frame order', () => {
    const strip = {
      width: 8,
      height: 1,
      rows: [Buffer.from([
        10, 0, 0, 255, 11, 0, 0, 255, 12, 0, 0, 255, 13, 0, 0, 255,
        20, 0, 0, 255, 21, 0, 0, 255, 22, 0, 0, 255, 23, 0, 0, 255
      ])]
    }

    const flipped = flipStripFrames(strip, 4)
    expect([...flipped.rows[0]]).toEqual([
      13, 0, 0, 255, 12, 0, 0, 255, 11, 0, 0, 255, 10, 0, 0, 255,
      23, 0, 0, 255, 22, 0, 0, 255, 21, 0, 0, 255, 20, 0, 0, 255
    ])
  })
})
