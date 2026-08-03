/**
 * Mirrors pixels horizontally inside each frame while preserving the frame order.
 * The source and destination rows are RGBA buffers.
 */
export function flipStripFrames(strip, frameWidth) {
  if (!Number.isInteger(frameWidth) || frameWidth <= 0 || strip.width % frameWidth !== 0) {
    throw new Error(`Frame width ${frameWidth} does not divide strip width ${strip.width}`)
  }

  const frameCount = strip.width / frameWidth
  return {
    width: strip.width,
    height: strip.height,
    rows: strip.rows.map((row) => {
      const copy = Buffer.from(row)
      for (let frame = 0; frame < frameCount; frame += 1) {
        const frameOffsetX = frame * frameWidth
        for (let x = 0; x < frameWidth; x += 1) {
          const src = (frameOffsetX + x) * 4
          const dst = (frameOffsetX + frameWidth - 1 - x) * 4
          copy[dst] = row[src]
          copy[dst + 1] = row[src + 1]
          copy[dst + 2] = row[src + 2]
          copy[dst + 3] = row[src + 3]
        }
      }
      return copy
    })
  }
}
