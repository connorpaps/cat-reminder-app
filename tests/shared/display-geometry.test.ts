import { describe, expect, it } from 'vitest'
import { clampWindowToWorkArea, sceneCenterPercent } from '../../src/shared/display-geometry'

describe('display geometry', () => {
  it('keeps a popup inside a 1920x1080 work area', () => {
    expect(clampWindowToWorkArea({ x: 0, y: 0, width: 1920, height: 1080 }, { width: 286, height: 620, margin: 8 })).toEqual({ x: 1622, y: 452, width: 286, height: 620 })
  })

  it('keeps a popup inside a 2560x1440 work area with negative origin', () => {
    expect(clampWindowToWorkArea({ x: -1920, y: 0, width: 1920, height: 1080 }, { width: 286, height: 620, margin: 8 })).toEqual({ x: -298, y: 452, width: 286, height: 620 })
  })

  it('scales scene bounds from logical CSS pixels without DPI double-scaling', () => {
    expect(sceneCenterPercent(90, 1080, 256)).toBeCloseTo(88.148, 2)
    expect(sceneCenterPercent(90, 1440, 256)).toBe(90)
  })
})
