export type WorkArea = { x: number; y: number; width: number; height: number }
export type WindowSize = { width: number; height: number; margin: number }
export type WindowBounds = { x: number; y: number; width: number; height: number }

/** Electron display bounds are already logical CSS pixels; never multiply by scaleFactor here. */
export function clampWindowToWorkArea(area: WorkArea, size: WindowSize): WindowBounds {
  const width = Math.min(size.width, Math.max(1, area.width - size.margin * 2))
  const height = Math.min(size.height, Math.max(1, area.height - size.margin * 2))
  return {
    x: Math.max(area.x + size.margin, Math.min(area.x + area.width - width - size.margin, area.x + area.width - width - 12)),
    y: Math.max(area.y + size.margin, Math.min(area.y + area.height - height - size.margin, area.y + area.height - height - 8)),
    width,
    height
  }
}

/** Fixed integer sprite scales remain crisp; these are CSS-pixel dimensions at 1080p and 1440p. */
export function sceneDimensions(_viewportWidth: number): { bubbleWidth: number; bubbleHeight: number; catHeight: number } {
  return { bubbleWidth: 256, bubbleHeight: 184, catHeight: 192 }
}

/** Keep a bubble fully visible while it is paused, using CSS/logical pixels. */
export function sceneCenterPercent(requestedPercent: number, viewportWidth: number, bubbleWidth: number): number {
  if (viewportWidth <= 0 || bubbleWidth <= 0) return requestedPercent
  const halfPercent = (bubbleWidth / viewportWidth) * 50
  return Math.max(halfPercent, Math.min(100 - halfPercent, requestedPercent))
}
