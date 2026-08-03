import { ANYTIME_SENTINEL_START, type Reminder, type ReminderPriority } from '../../../shared/types/reminder'
import type { TickTickProject, TickTickSyncResult, TickTickTask } from '../../../shared/types/ticktick'
import { ReminderRepository } from '../../storage/reminder-repository'
import { TICKTICK_API_BASE } from './oauth'

export interface TickTickClient {
  listProjects(): Promise<TickTickProject[]>
  listTasks(projectIds: string[]): Promise<Array<{ projectId: string; tasks: TickTickTask[] }>>
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** TickTick priority: 0 none, 1 low, 3 medium, 5 high. */
function tickTickPriority(priority?: number): ReminderPriority {
  if (priority === 5) return 'high'
  if (priority === 1) return 'low'
  return 'normal'
}

/**
 * Maps a TickTick task onto our kinded reminder model (display-only; nothing is
 * ever written back to TickTick):
 * - `status 2` (completed) → completed reminder.
 * - no `dueDate` → `anytime` (feeds the daily task roll-up every day until done).
 * - `isAllDay` or a date-only `dueDate` → `all-day` anchored to local midnight.
 * - otherwise → `timed` (fires the cat overlay at our lead time).
 */
export function taskToReminder(task: TickTickTask, now = new Date()): Reminder {
  const base: Omit<Reminder, 'kind' | 'startAt'> = {
    id: `ticktick:${task.projectId}:${task.id}`,
    title: task.title || 'Untitled task',
    description: task.desc || task.content,
    timezone: task.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    priority: tickTickPriority(task.priority),
    status: task.status === 2 ? 'completed' : 'upcoming',
    enabled: task.status !== 2,
    source: 'ticktick',
    sourceEventId: task.id,
    sourceCalendarId: task.projectId,
    endAt: undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }
  if (task.status === 2) return { ...base, kind: 'timed', startAt: task.dueDate ?? ANYTIME_SENTINEL_START }
  if (!task.dueDate) return { ...base, kind: 'anytime', startAt: ANYTIME_SENTINEL_START }
  if (task.isAllDay || DATE_ONLY_PATTERN.test(task.dueDate)) {
    const due = new Date(task.dueDate)
    const localMidnight = new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
    return { ...base, kind: 'all-day', startAt: localMidnight.toISOString() }
  }
  return { ...base, kind: 'timed', startAt: task.dueDate }
}

// Timed tasks are only imported inside the rolling window (same policy as Google
// Tasks); all-day/anytime tasks always belong to the roll-up.
const IMPORT_WINDOW_MS = 60 * 86_400_000

export class TickTickSyncService {
  constructor(
    private readonly repository: ReminderRepository,
    private readonly client: TickTickClient
  ) {}

  async sync(projectIds: string[], now = new Date()): Promise<TickTickSyncResult> {
    const projectTasks = await this.client.listTasks(projectIds)
    let imported = 0
    let updated = 0
    const activeTaskIds = new Set<string>()
    const existingById = new Map(
      this.repository.list()
        .filter((item) => item.source === 'ticktick')
        .map((item) => [`${item.sourceCalendarId}:${item.sourceEventId}`, item])
    )

    for (const { projectId, tasks } of projectTasks) {
      for (const task of tasks) {
        activeTaskIds.add(task.id)
        const reminder = taskToReminder(task, now)
        if (reminder.kind === 'timed' && new Date(reminder.startAt).getTime() > now.getTime() + IMPORT_WINDOW_MS) continue
        const existing = existingById.get(`${projectId}:${task.id}`)
        this.repository.upsertImported(reminder)
        // The upsert never touches status/enabled, so a task completed in TickTick
        // but still present in the response must be completed locally (the pruning
        // loop below covers the case where it has already disappeared).
        if (reminder.status === 'completed') {
          this.repository.update(reminder.id, { status: 'completed', enabled: false })
        }
        if (existing) updated += 1
        else imported += 1
      }
    }

    // Tasks that were active last sync but no longer appear were completed or
    // deleted in TickTick → mark them completed locally so they leave the cat
    // overlay and the daily roll-up. Only reminders inside the synced projects
    // are touched (a deselected project must keep its reminders as-is).
    let completed = 0
    const syncedProjectIds = new Set(projectIds)
    for (const reminder of this.repository.list()) {
      if (reminder.source !== 'ticktick') continue
      if (!reminder.sourceCalendarId || !syncedProjectIds.has(reminder.sourceCalendarId)) continue
      if (reminder.status === 'completed' || reminder.status === 'dismissed') continue
      if (reminder.sourceEventId && activeTaskIds.has(reminder.sourceEventId)) continue
      this.repository.update(reminder.id, { status: 'completed' })
      completed += 1
    }

    return { imported, updated, completed, syncedAt: now.toISOString() }
  }
}

export function createTickTickClient(config: { accessToken: string }): TickTickClient {
  const headers = { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' }
  return {
    async listProjects() {
      const response = await fetch(`${TICKTICK_API_BASE}/project`, { headers })
      if (!response.ok) throw new Error(`TickTick API error ${response.status}`)
      const projects = (await response.json()) as TickTickProject[]
      return projects
        .filter((project) => project.id)
        .map((project) => ({ id: project.id, name: project.name, color: project.color, sortOrder: project.sortOrder, closed: project.closed }))
    },
    async listTasks(projectIds) {
      const results: Array<{ projectId: string; tasks: TickTickTask[] }> = []
      for (const projectId of projectIds) {
        const response = await fetch(`${TICKTICK_API_BASE}/project/${encodeURIComponent(projectId)}/data`, { headers })
        // A project that disappeared (deleted in TickTick) is skipped, not fatal.
        if (response.status === 404) continue
        if (!response.ok) throw new Error(`TickTick API error ${response.status}`)
        const data = (await response.json()) as { project?: TickTickProject; tasks?: TickTickTask[] }
        const tasks = (data.tasks ?? []).map((task) => ({ ...task, projectId: task.projectId || projectId }))
        results.push({ projectId, tasks })
      }
      return results
    }
  }
}
