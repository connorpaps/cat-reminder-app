import type { Reminder } from '../../shared/types/reminder'
import type { OverlayReminder, OverlayTaskItem } from '../../shared/types/overlay'
import type { FullscreenPolicy, Preferences } from '../../shared/types/preferences'
import type { ReminderRepository } from '../storage/reminder-repository'
import type { DailyRollupState, DailyTaskRollupRepository } from '../storage/task-rollup-repository'

export const DAILY_TASKS_ID_PREFIX = 'daily-tasks:'

export function isDailyTaskRollupId(id: string): boolean {
  return id.startsWith(DAILY_TASKS_ID_PREFIX)
}

/** Local calendar date key, e.g. '2026-08-02'. */
export function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Decides whether the daily roll-up should appear right now.
 * Pure and unit-testable. `state` is the per-day state (undefined = pending).
 */
export function rollupDecision(now: Date, reminderTime: string, state: DailyRollupState | undefined, hasTasks: boolean): 'skip' | 'show' {
  const [hour, minute] = reminderTime.split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 'skip'
  const scheduledToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
  if (now < scheduledToday) return 'skip' // before the configured time today
  if (!hasTasks) return 'skip' // nothing to show (stays pending so late additions can still fire)
  if (!state) return 'show'
  if (state.status === 'dismissed') return 'skip'
  if (state.status === 'shown') return 'skip' // seen once today
  if (state.status === 'snoozed') {
    // Reappear once the snooze window has elapsed; guard against a missing timestamp.
    if (!state.snoozeUntil) return 'show'
    return now >= new Date(state.snoozeUntil) ? 'show' : 'skip'
  }
  return 'show'
}

/** Builds the synthetic overlay payload that carries the day's task list. */
export function buildRollupOverlay(tasks: Reminder[], date: string, now = new Date(), assetBaseUrl?: string): OverlayReminder {
  const reminder: Reminder = {
    id: `${DAILY_TASKS_ID_PREFIX}${date}`,
    kind: 'timed', // synthetic; never scheduled through the timed pipeline
    title: "Today's tasks",
    startAt: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    priority: 'normal',
    status: 'upcoming',
    enabled: true,
    source: 'manual',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }
  const taskItems: OverlayTaskItem[] = tasks.map((task) => ({
    title: task.title,
    description: task.description
  }))
  return { reminder, taskItems, rollup: true, queuedAt: now.toISOString(), assetBaseUrl }
}

export type TaskRollupSchedulerOptions = {
  repository: ReminderRepository
  state: DailyTaskRollupRepository
  preferences: () => Preferences
  /** True when the timed-reminder trigger queue is idle so the roll-up does not fight a live cat. */
  isQueueIdle: () => boolean
  /** Resolves asset URLs for packaged builds (matching the timed reminder path). */
  assetBaseUrl: () => string | undefined
  show: (payload: OverlayReminder, policy: FullscreenPolicy) => Promise<boolean>
}

export class TaskRollupScheduler {
  constructor(private readonly options: TaskRollupSchedulerOptions) {}

  check(now = new Date()): void {
    const preferences = this.options.preferences()
    if (!preferences.dailyTaskReminderEnabled) return
    if (!this.options.isQueueIdle()) return
    const date = dayKey(now)
    const state = this.options.state.get(date)
    const tasks = this.options.repository.todayTasks(now)
    if (rollupDecision(now, preferences.dailyTaskReminderTime, state, tasks.length > 0) !== 'show') return
    const payload = buildRollupOverlay(tasks, date, now, this.options.assetBaseUrl())
    void this.options.show(payload, preferences.fullscreenPolicy).then((shown) => {
      if (shown) this.options.state.markShown(date)
    })
  }
}
