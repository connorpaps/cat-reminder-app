import type { OverlayReminder } from '../shared/types/overlay'

export {}

declare global {
  interface Window {
    catOverlay: {
      onShow: (listener: (payload: OverlayReminder) => void) => () => void
      action: (id: string, action: 'snooze' | 'dismiss' | 'complete') => void
      ready: () => void
      setIgnoreMouseEvents: (ignore: boolean) => void
      animationComplete: (id: string) => void
    }
  }
}
