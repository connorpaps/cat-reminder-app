export type AnimationIntensity = 'low' | 'medium' | 'high'
export type FullscreenPolicy = 'respect' | 'show' | 'suppress'

export type Preferences = {
  /** Which cat the overlay walks (id from the CATS registry in shared/animation). */
  selectedCatId: string
  onboardingCompleted: boolean
  launchAtLogin: boolean
  openInTray: boolean
  soundEnabled: boolean
  bubbleEnabled: boolean
  animationIntensity: AnimationIntensity
  reminderLeadTimeMinutes: number
  snoozeMinutes: number
  syncEnabled: boolean
  syncIntervalMinutes: number
  fullscreenPolicy: FullscreenPolicy
  /** Show the day's time-less tasks as one cat roll-up at `dailyTaskReminderTime` each day. */
  dailyTaskReminderEnabled: boolean
  /** Local wall-clock time (HH:mm) at which the daily task roll-up appears. */
  dailyTaskReminderTime: string
}

export const DEFAULT_PREFERENCES: Preferences = {
  selectedCatId: 'default',
  onboardingCompleted: false,
  launchAtLogin: false,
  openInTray: true,
  // On by default so the chime is actually heard; the popup Sound toggle can disable it.
  soundEnabled: true,
  bubbleEnabled: true,
  animationIntensity: 'medium',
  reminderLeadTimeMinutes: 5,
  snoozeMinutes: 10,
  syncEnabled: false,
  syncIntervalMinutes: 5,
  fullscreenPolicy: 'respect',
  dailyTaskReminderEnabled: true,
  dailyTaskReminderTime: '09:00'
}
