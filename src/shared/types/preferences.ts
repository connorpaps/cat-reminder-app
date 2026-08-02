export type AnimationIntensity = 'low' | 'medium' | 'high'
export type FullscreenPolicy = 'respect' | 'show' | 'suppress'

export type Preferences = {
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
}

export const DEFAULT_PREFERENCES: Preferences = {
  onboardingCompleted: false,
  launchAtLogin: false,
  openInTray: true,
  soundEnabled: false,
  bubbleEnabled: true,
  animationIntensity: 'medium',
  reminderLeadTimeMinutes: 5,
  snoozeMinutes: 10,
  syncEnabled: false,
  syncIntervalMinutes: 5,
  fullscreenPolicy: 'respect'
}
