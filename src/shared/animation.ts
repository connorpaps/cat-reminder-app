export type SpriteAnimationManifest = {
  id: string
  src: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps: number
  scale: number
  imageRendering: 'pixelated'
  /** Transparent rows below the lowest foot in the source sheet; the sprite is dropped by feetPaddingPx * scale so its feet, not the frame bottom, touch the walk line. */
  feetPaddingPx: number
}

export const DEFAULT_CAT_ANIMATIONS: Record<string, SpriteAnimationManifest> = {
  // idle is a sitting pose: base flush with the frame bottom (0px padding), drawn facing left.
  idle: { id: 'default-idle', src: 'assets/cats/default/idle.png', frameWidth: 64, frameHeight: 64, frameCount: 6, fps: 8, scale: 3, imageRendering: 'pixelated', feetPaddingPx: 0 },
  // running feet reach row 58 of 63 in the contact frames (5px of padding below them); drawn facing right.
  running: { id: 'default-running', src: 'assets/cats/default/running.png', frameWidth: 64, frameHeight: 64, frameCount: 6, fps: 10, scale: 3, imageRendering: 'pixelated', feetPaddingPx: 5 }
}

// Full traversal time for the running sprite across the whole screen (-12% → 112%).
// 12_375ms + 10% = 13_612.5ms, rounded to a whole millisecond.
export const CAT_TRAVEL_DURATION_MS = 13_613
export const CAT_TRAVEL_START_PERCENT = -12
export const CAT_TRAVEL_END_PERCENT = 112

// The show is split into three phases: walk across → idle pause near the right
// edge → walk off screen. The pause keeps the cat (and its bubble) on-screen and
// interactive for a beat before it exits.
export const CAT_PAUSE_DURATION_MS = 5_000
export const CAT_PAUSE_POSITION_PERCENT = 90

export type OverlayPhase = 'walking' | 'pausing' | 'exiting'

const walkSpan = CAT_PAUSE_POSITION_PERCENT - CAT_TRAVEL_START_PERCENT
const exitSpan = CAT_TRAVEL_END_PERCENT - CAT_PAUSE_POSITION_PERCENT
const fullSpan = CAT_TRAVEL_END_PERCENT - CAT_TRAVEL_START_PERCENT

export function walkDurationMs(): number {
  return Math.round(CAT_TRAVEL_DURATION_MS * (walkSpan / fullSpan))
}

export function exitDurationMs(): number {
  return Math.round(CAT_TRAVEL_DURATION_MS * (exitSpan / fullSpan))
}

export function totalShowDurationMs(): number {
  return walkDurationMs() + CAT_PAUSE_DURATION_MS + exitDurationMs()
}

export function phaseAt(elapsedMs: number): OverlayPhase {
  if (elapsedMs < walkDurationMs()) return 'walking'
  if (elapsedMs < walkDurationMs() + CAT_PAUSE_DURATION_MS) return 'pausing'
  return 'exiting'
}

export function traversalPositionAt(elapsedMs: number): number {
  const clamped = Math.max(0, elapsedMs)
  const walkMs = walkDurationMs()
  if (clamped < walkMs) {
    return CAT_TRAVEL_START_PERCENT + walkSpan * (clamped / walkMs)
  }
  const pauseEnd = walkMs + CAT_PAUSE_DURATION_MS
  if (clamped < pauseEnd) return CAT_PAUSE_POSITION_PERCENT
  return Math.min(CAT_TRAVEL_END_PERCENT, CAT_PAUSE_POSITION_PERCENT + exitSpan * ((clamped - pauseEnd) / exitDurationMs()))
}

// textbox.png contains several separate pixel-art panels. The MVP uses only
// the compact panel at the top-center of the sheet (source pixels x=16..47,
// y=0..15) and the large panel (x=1..62, y=17..62) for the daily task roll-up
// list, never the lower decorative controls.
export type TextboxSpriteManifest = {
  src: string
  sheetWidth: number
  sheetHeight: number
  panelX: number
  panelY: number
  panelWidth: number
  panelHeight: number
  scale: number
}

export const TEXTBOX_SPRITE: TextboxSpriteManifest = {
  src: 'assets/textbox/textbox.png',
  sheetWidth: 64,
  sheetHeight: 96,
  panelX: 16,
  panelY: 0,
  panelWidth: 32,
  panelHeight: 16,
  scale: 8
}

export const TEXTBOX_LARGE_SPRITE: TextboxSpriteManifest = {
  src: 'assets/textbox/textbox.png',
  sheetWidth: 64,
  sheetHeight: 96,
  panelX: 1,
  panelY: 17,
  panelWidth: 62,
  panelHeight: 46,
  scale: 4
}

export function spriteOffset(manifest: SpriteAnimationManifest, frame: number): string {
  const safeFrame = ((frame % manifest.frameCount) + manifest.frameCount) % manifest.frameCount
  return `-${safeFrame * manifest.frameWidth * manifest.scale}px 0px`
}

export function traversalProgress(elapsedMs: number, durationMs = CAT_TRAVEL_DURATION_MS): number {
  if (durationMs <= 0) return 1
  return Math.min(1, Math.max(0, elapsedMs / durationMs))
}

export function traversalPositionPercent(progress: number): number {
  const safeProgress = Math.min(1, Math.max(0, progress))
  return CAT_TRAVEL_START_PERCENT + (CAT_TRAVEL_END_PERCENT - CAT_TRAVEL_START_PERCENT) * safeProgress
}
