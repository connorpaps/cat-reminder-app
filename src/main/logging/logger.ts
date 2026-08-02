import log from 'electron-log/main'

log.initialize()

export const logger = {
  info: (message: string, meta?: unknown) => log.info(message, meta ?? ''),
  warn: (message: string, meta?: unknown) => log.warn(message, meta ?? ''),
  error: (message: string, error?: unknown) => log.error(message, error ?? '')
}
