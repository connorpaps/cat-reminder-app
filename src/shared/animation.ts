export type SpriteAnimationManifest = {
  id: string
  src: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps: number
  scale: number
  imageRendering: 'pixelated'
}

export const DEFAULT_CAT_ANIMATIONS: Record<string, SpriteAnimationManifest> = {
  idle: { id: 'default-idle', src: 'assets/cats/default/idle.png', frameWidth: 64, frameHeight: 64, frameCount: 6, fps: 8, scale: 3, imageRendering: 'pixelated' },
  running: { id: 'default-running', src: 'assets/cats/default/running.png', frameWidth: 64, frameHeight: 64, frameCount: 6, fps: 10, scale: 3, imageRendering: 'pixelated' }
}

export const CAT_TRAVEL_DURATION_MS = 12_375
export const CAT_TRAVEL_START_PERCENT = -12
export const CAT_TRAVEL_END_PERCENT = 112

// textbox.png contains several separate pixel-art panels. The MVP uses only
// the compact panel at the top-center of the sheet (source pixels x=16..47,
// y=0..15), never the large panel or the lower decorative controls.
export const TEXTBOX_SPRITE = {
  src: 'assets/textbox/textbox.png',
  sheetWidth: 64,
  sheetHeight: 96,
  panelX: 16,
  panelY: 0,
  panelWidth: 32,
  panelHeight: 16,
  scale: 8
} as const

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
