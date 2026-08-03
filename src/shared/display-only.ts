import type { ReminderStatus, ReminderSource } from './types/reminder'

/** Provider state is displayed locally but never completed by Cat Reminder. */
export const DISPLAY_ONLY_HIDDEN_STATUS: ReminderStatus = 'dismissed'

type ProviderScope = {
  provider: Extract<ReminderSource, 'google-calendar' | 'google-tasks' | 'ticktick'>
  syncedScopeIds: string[]
  seenKeys: Set<string>
}

/** True only when a full successful provider response covered the reminder's scope. */
export function shouldHideProviderReminder(
  reminder: { source: ReminderSource; sourceCalendarId?: string; sourceEventId?: string },
  scope: ProviderScope
): boolean {
  if (reminder.source !== scope.provider || !reminder.sourceCalendarId || !reminder.sourceEventId) return false
  if (!scope.syncedScopeIds.includes(reminder.sourceCalendarId)) return false
  return !scope.seenKeys.has(`${reminder.sourceCalendarId}:${reminder.sourceEventId}`)
}
