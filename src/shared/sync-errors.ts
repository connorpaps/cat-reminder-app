const GOOGLE_TASKS_API_BASE = 'https://console.developers.google.com/apis/api/tasks.googleapis.com/overview'

export function formatSyncError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const disabledTasksApi = message.match(/Google Tasks API has not been used in project (\d+) before or it is disabled/i)
  if (disabledTasksApi) {
    return `Google Tasks API is disabled. Enable it here: ${GOOGLE_TASKS_API_BASE}?project=${disabledTasksApi[1]}`
  }
  if (message.includes('insufficient authentication scopes')) {
    return 'Google permissions are outdated. Disconnect and reconnect Google to grant Calendar + Tasks access.'
  }
  return message.length > 240 ? `${message.slice(0, 237)}…` : message
}
