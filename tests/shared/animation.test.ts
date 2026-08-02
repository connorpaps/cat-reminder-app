import { describe, expect, it } from 'vitest'
import { CAT_TRAVEL_DURATION_MS, DEFAULT_CAT_ANIMATIONS, spriteOffset, traversalPositionPercent, traversalProgress } from '../../src/shared/animation'

describe('cat animation metadata', () => {
  it('describes six 64px frames for the supplied running sheet', () => {
    expect(DEFAULT_CAT_ANIMATIONS.running.frameCount).toBe(6)
    expect(DEFAULT_CAT_ANIMATIONS.running.frameWidth).toBe(64)
    expect(spriteOffset(DEFAULT_CAT_ANIMATIONS.running, 1)).toBe('-192px 0px')
    expect(spriteOffset(DEFAULT_CAT_ANIMATIONS.running, 6)).toBe('-0px 0px')
  })

  it('traverses from offscreen left to offscreen right', () => {
    expect(traversalProgress(-1)).toBe(0)
    expect(traversalProgress(CAT_TRAVEL_DURATION_MS / 2)).toBeCloseTo(0.5)
    expect(traversalProgress(CAT_TRAVEL_DURATION_MS + 1)).toBe(1)
    expect(traversalPositionPercent(0)).toBe(-12)
    expect(traversalPositionPercent(1)).toBe(112)
  })
})
