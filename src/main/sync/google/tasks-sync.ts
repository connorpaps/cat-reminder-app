import { google } from 'googleapis'
import type { Reminder } from '../../../shared/types/reminder'
import { ReminderRepository } from '../../storage/reminder-repository'

export type GoogleTaskItem = {
  id: string
  taskListId: string
  title: string
  notes?: string
  due?: string
  status: string
}

export type GoogleTaskList = {
  id: string
  title: string
}

export type TasksSyncResult = {
  imported: number
  updated: number
  skipped: number
  syncedAt: string
}

export interface GoogleTasksClient {
  listTaskLists(): Promise<GoogleTaskList[]>
  listUpcomingTasks(taskListIds: string[], dueMax: string): Promise<GoogleTaskItem[]>
}

export function taskToReminder(task: GoogleTaskItem, now = new Date()): Reminder | null {
  // Skip tasks without a due date — they aren't time-sensitive reminders.
  if (!task.due) return null
  return {
    id: `google-tasks:${task.taskListId}:${task.id}`,
    title: task.title || 'Untitled task',
    description: task.notes,
    startAt: task.due,
    endAt: undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    priority: 'normal',
    status: task.status === 'completed' ? 'completed' : 'upcoming',
    enabled: task.status !== 'completed',
    source: 'google-tasks',
    sourceEventId: task.id,
    sourceCalendarId: task.taskListId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }
}

export class GoogleTasksSyncService {
  constructor(
    private readonly repository: ReminderRepository,
    private readonly client: GoogleTasksClient
  ) {}

  async sync(taskListIds: string[], now = new Date()): Promise<TasksSyncResult> {
    const dueMax = new Date(now.getTime() + 60 * 86_400_000).toISOString()
    const tasks = await this.client.listUpcomingTasks(taskListIds, dueMax)
    let imported = 0
    let updated = 0

    for (const task of tasks) {
      if (!task.due) continue
      const reminder = taskToReminder(task, now)
      if (!reminder) continue
      const existing = this.repository.list().find(
        (item) => item.sourceEventId === task.id && item.sourceCalendarId === task.taskListId && item.source === 'google-tasks'
      )
      this.repository.upsertImported(reminder)
      if (existing) updated += 1
      else imported += 1
    }

    return { imported, updated, skipped: 0, syncedAt: now.toISOString() }
  }
}

export function createGoogleTasksClient(config: {
  accessToken: string
  refreshToken?: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): GoogleTasksClient {
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
  auth.setCredentials({ access_token: config.accessToken, refresh_token: config.refreshToken })
  const tasks = google.tasks({ version: 'v1', auth })

  return {
    async listTaskLists() {
      const response = await tasks.tasklists.list({ maxResults: 100 })
      return (response.data.items ?? []).map((item) => ({
        id: item.id ?? '',
        title: item.title ?? 'Unnamed task list'
      })).filter((item) => item.id)
    },
    async listUpcomingTasks(taskListIds, dueMax) {
      const items: GoogleTaskItem[] = []
      for (const taskListId of taskListIds) {
        const response = await tasks.tasks.list({
          tasklist: taskListId,
          showCompleted: false,
          showHidden: false,
          dueMax,
          maxResults: 100
        })
        for (const task of response.data.items ?? []) {
          if (!task.id || !task.title) continue
          items.push({
            id: task.id,
            taskListId,
            title: task.title,
            notes: task.notes ?? undefined,
            due: task.due ?? undefined,
            status: task.status ?? 'needsAction'
          })
        }
      }
      return items
    }
  }
}
