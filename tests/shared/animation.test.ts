import { describe, expect, it } from 'vitest'
import { CAT_PAUSE_DURATION_MS, CAT_PAUSE_POSITION_PERCENT, CAT_TRAVEL_DURATION_MS, CAT_TRAVEL_END_PERCENT, CAT_TRAVEL_START_PERCENT, DEFAULT_CAT_ANIMATIONS, exitDurationMs, phaseAt, spriteOffset, totalShowDurationMs, traversalPositionAt, walkDurationMs } from '../../src/shared/animation'

describe('cat animation metadata', () => {
  it('describes six 64px frames for the supplied running sheet', () => {
    expect(DEFAULT_CAT_ANIMATIONS.running.frameCount).toBe(6)
    expect(DEFAULT_CAT_ANIMATIONS.running.frameWidth).toBe(64)
    expect(spriteOffset(DEFAULT_CAT_ANIMATIONS.running, 1)).toBe('-192px 0px')
    expect(spriteOffset(DEFAULT_CAT_ANIMATIONS.running, 6)).toBe('-0px 0px')
  })

  it('declares feet padding per sheet so the feet, not the frame, touch the walk line', () => {
    // Measured from the source PNGs: idle is a sitting pose flush with the bottom,
    // running feet reach row 58 of 63 (5px of transparent padding below them).
    expect(DEFAULT_CAT_ANIMATIONS.idle.feetPaddingPx).toBe(0)
    expect(DEFAULT_CAT_ANIMATIONS.running.feetPaddingPx).toBe(5)
    // Rendered drop = padding * integer scale (3x).
    expect(DEFAULT_CAT_ANIMATIONS.running.feetPaddingPx * DEFAULT_CAT_ANIMATIONS.running.scale).toBe(15)
  })

  it('slows the traversal by 10% (12_375ms → 13_613ms)', () => {
    expect(CAT_TRAVEL_DURATION_MS).toBe(13_613)
  })

  it('splits the show into walk → 5s idle pause → exit', () => {
    expect(CAT_PAUSE_DURATION_MS).toBe(5_000)
    expect(phaseAt(-1)).toBe('walking')
    expect(phaseAt(walkDurationMs())).toBe('pausing')
    expect(phaseAt(walkDurationMs() + CAT_PAUSE_DURATION_MS / 2)).toBe('pausing')
    expect(phaseAt(walkDurationMs() + CAT_PAUSE_DURATION_MS)).toBe('exiting')
    expect(phaseAt(walkDurationMs() + CAT_PAUSE_DURATION_MS + exitDurationMs())).toBe('exiting')
    expect(totalShowDurationMs()).toBe(walkDurationMs() + CAT_PAUSE_DURATION_MS + exitDurationMs())
    // Walk + exit reuse the full traversal time, so the total adds exactly one pause.
    expect(walkDurationMs() + exitDurationMs()).toBe(CAT_TRAVEL_DURATION_MS)
  })

  it('holds the cat at the pause position during the idle pause', () => {
    expect(traversalPositionAt(0)).toBe(CAT_TRAVEL_START_PERCENT)
    expect(traversalPositionAt(walkDurationMs())).toBe(CAT_PAUSE_POSITION_PERCENT)
    expect(traversalPositionAt(walkDurationMs() + CAT_PAUSE_DURATION_MS / 2)).toBe(CAT_PAUSE_POSITION_PERCENT)
    expect(traversalPositionAt(walkDurationMs() + CAT_PAUSE_DURATION_MS)).toBe(CAT_PAUSE_POSITION_PERCENT)
    expect(traversalPositionAt(totalShowDurationMs())).toBe(CAT_TRAVEL_END_PERCENT)
    expect(traversalPositionAt(totalShowDurationMs() + 5_000)).toBe(CAT_TRAVEL_END_PERCENT)
  })
})
