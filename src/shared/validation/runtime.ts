import { CAT_IDS } from '../animation'
import type { CreateReminderInput, ReminderKind, ReminderPriority, UpdateReminderInput } from '../types/reminder'
import type { Preferences } from '../types/preferences'

const priorities = new Set<ReminderPriority>(['low', 'normal', 'high', 'urgent'])
const kinds = new Set<ReminderKind>(['timed', 'all-day', 'anytime'])
const statuses = new Set(['upcoming', 'soon', 'due', 'overdue', 'snoozed', 'completed', 'dismissed'])
const frequencies = new Set(['daily', 'weekly', 'monthly'])
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

const preferenceKeys = new Set<keyof Preferences>([
  'selectedCatId', 'onboardingCompleted', 'launchAtLogin', 'openInTray', 'soundEnabled', 'bubbleEnabled',
  'animationIntensity', 'reminderLeadTimeMinutes', 'snoozeMinutes', 'syncEnabled', 'syncIntervalMinutes', 'fullscreenPolicy',
  'dailyTaskReminderEnabled', 'dailyTaskReminderTime'
])

function validRepeatRule(value: unknown): boolean {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false
  const rule = value as Record<string, unknown>
  if (!frequencies.has(rule.frequency as string)) return false
  if (rule.interval !== undefined && (typeof rule.interval !== 'number' || !Number.isInteger(rule.interval) || rule.interval < 1)) return false
  if (rule.dayOfMonth !== undefined && (typeof rule.dayOfMonth !== 'number' || !Number.isInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31)) return false
  if (rule.daysOfWeek !== undefined && (!Array.isArray(rule.daysOfWeek) || rule.daysOfWeek.some((day) => typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6))) return false
  return true
}

export function isReminderId(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 128 }
export function isReminderAction(value: unknown): value is 'snooze' | 'dismiss' | 'complete' { return value === 'snooze' || value === 'dismiss' || value === 'complete' }

export function isCreateReminderInput(value: unknown): value is CreateReminderInput {
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  if (typeof input.title !== 'string' || input.title.trim().length === 0 || input.title.length > 160) return false
  const kind = (input.kind ?? 'timed') as ReminderKind
  if (!kinds.has(kind)) return false
  if (input.startAt !== undefined && (typeof input.startAt !== 'string' || Number.isNaN(new Date(input.startAt).getTime()))) return false
  // `timed`/`all-day` require a start time; `anytime` may omit it.
  if (kind !== 'anytime' && (typeof input.startAt !== 'string' || Number.isNaN(new Date(input.startAt).getTime()))) return false
  if (input.repeatRule !== undefined && kind !== 'timed') return false
  if (input.endAt !== undefined && (typeof input.endAt !== 'string' || Number.isNaN(new Date(input.endAt).getTime()))) return false
  if (input.description !== undefined && typeof input.description !== 'string') return false
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') return false
  if (!isValidTimeZone(input.timezone)) return false
  if (!priorities.has(input.priority as ReminderPriority) || !validRepeatRule(input.repeatRule)) return false
  return true
}

export function isUpdateReminderInput(value: unknown): value is UpdateReminderInput {
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  // A reminder's kind is fixed at creation; it can't be changed via updates.
  if (input.kind !== undefined) return false
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.trim().length === 0 || input.title.length > 160)) return false
  if (input.description !== undefined && typeof input.description !== 'string') return false
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') return false
  if (input.startAt !== undefined && (typeof input.startAt !== 'string' || Number.isNaN(new Date(input.startAt).getTime()))) return false
  if (input.endAt !== undefined && (typeof input.endAt !== 'string' || Number.isNaN(new Date(input.endAt).getTime()))) return false
  if (input.timezone !== undefined && !isValidTimeZone(input.timezone)) return false
  if (input.priority !== undefined && !priorities.has(input.priority as ReminderPriority)) return false
  if (input.status !== undefined && !statuses.has(input.status as string)) return false
  return validRepeatRule(input.repeatRule)
}

export function isPreferencesPatch(value: unknown): value is Partial<Preferences> {
  if (!value || typeof value !== 'object') return false
  for (const [key, entry] of Object.entries(value)) {
    if (!preferenceKeys.has(key as keyof Preferences)) return false
    if (key.endsWith('Minutes') && (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 1 || entry > 24 * 60)) return false
    if (key === 'animationIntensity' && !['low', 'medium', 'high'].includes(entry as string)) return false
    if (key === 'fullscreenPolicy' && !['respect', 'show', 'suppress'].includes(entry as string)) return false
    if (['onboardingCompleted', 'launchAtLogin', 'openInTray', 'soundEnabled', 'bubbleEnabled', 'syncEnabled', 'dailyTaskReminderEnabled'].includes(key) && typeof entry !== 'boolean') return false
    if (key === 'dailyTaskReminderTime' && (typeof entry !== 'string' || !timePattern.test(entry))) return false
    if (key === 'selectedCatId' && (typeof entry !== 'string' || !(CAT_IDS as string[]).includes(entry))) return false
  }
  return true
}
