import type { Reminder } from './reminder'
import type { AnimationIntensity } from './preferences'

export type OverlayReminder = {
  reminder: Reminder
  queuedAt: string
  animationStartedAt?: number
  assetBaseUrl?: string
  preview?: boolean
  animationIntensity?: AnimationIntensity
}

export type OverlayAction = 'snooze' | 'dismiss' | 'complete' | 'open'

export type DisplayBounds = {
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
}
