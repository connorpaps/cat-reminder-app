import type { Reminder } from './reminder'
import type { AnimationIntensity } from './preferences'

export type OverlayTaskItem = {
  title: string
  description?: string
}

export type OverlayReminder = {
  reminder: Reminder
  queuedAt: string
  animationStartedAt?: number
  assetBaseUrl?: string
  preview?: boolean
  animationIntensity?: AnimationIntensity
  /** CSS pixels from the bottom of the overlay window to the cat's walking line (the taskbar's inner edge). */
  walkBaselineFromBottom?: number
  /** When present, the bubble renders this compact task list instead of a description. */
  taskItems?: OverlayTaskItem[]
  /** Marks the daily task roll-up reminder: Snooze/Dismiss buttons, and walking off does not auto-dismiss it. */
  rollup?: boolean
}

export type OverlayAction = 'snooze' | 'dismiss' | 'complete' | 'open'
