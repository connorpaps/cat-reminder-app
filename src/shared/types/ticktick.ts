export type TickTickProject = {
  id: string
  name: string
  color?: string
  sortOrder?: number
  closed?: boolean
}

export type TickTickTask = {
  id: string
  projectId: string
  title: string
  content?: string
  desc?: string
  isAllDay?: boolean
  startDate?: string
  dueDate?: string
  timeZone?: string
  reminders?: string[]
  repeatFlag?: string
  priority?: number
  status?: number
  completedTime?: string
}

export type TickTickSyncResult = {
  imported: number
  updated: number
  completed: number
  syncedAt: string
}
