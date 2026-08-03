import { contextBridge, ipcRenderer } from 'electron'
import type { CatReminderApi } from '../shared/ipc'
import type { CreateReminderInput, UpdateReminderInput } from '../shared/types/reminder'
import type { Preferences } from '../shared/types/preferences'

const api: CatReminderApi = {
  reminders: {
    list: () => ipcRenderer.invoke('reminders:list'),
    create: (input: CreateReminderInput) => ipcRenderer.invoke('reminders:create', input),
    update: (id: string, input: UpdateReminderInput) => ipcRenderer.invoke('reminders:update', id, input),
    remove: (id: string) => ipcRenderer.invoke('reminders:remove', id),
    action: (id, action) => ipcRenderer.invoke('reminders:action', id, action)
  },
  preferences: {
    get: () => ipcRenderer.invoke('preferences:get'),
    update: (input: Partial<Preferences>) => ipcRenderer.invoke('preferences:update', input)
  },
  sync: {
    status: () => ipcRenderer.invoke('sync:status'),
    connect: () => ipcRenderer.invoke('sync:connect'),
    selectCalendars: (calendarIds: string[]) => ipcRenderer.invoke('sync:select-calendars', calendarIds),
    refresh: () => ipcRenderer.invoke('sync:refresh'),
    disconnect: () => ipcRenderer.invoke('sync:disconnect')
  },
  ticktick: {
    status: () => ipcRenderer.invoke('ticktick:status'),
    connect: () => ipcRenderer.invoke('ticktick:connect'),
    selectProjects: (projectIds: string[]) => ipcRenderer.invoke('ticktick:select-projects', projectIds),
    refresh: () => ipcRenderer.invoke('ticktick:refresh'),
    disconnect: () => ipcRenderer.invoke('ticktick:disconnect')
  },
  app: {
    openSettings: () => ipcRenderer.invoke('app:open-settings'),
    showTestOverlay: () => ipcRenderer.invoke('app:test-overlay'),
    quit: () => ipcRenderer.invoke('app:quit')
  }
}

contextBridge.exposeInMainWorld('catReminder', api)
