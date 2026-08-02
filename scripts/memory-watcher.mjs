#!/usr/bin/env node
/**
 * Auto-memory file watcher (zero input, local-only).
 *
 * Watches the project for file changes and appends a timestamped entry to
 * docs/activity-watch.log (gitignored). This is a raw, mechanical record of
 * every file save — useful as a fallback when no commit has been made yet.
 *
 * Usage:  node scripts/memory-watcher.mjs
 * Stop:   Ctrl+C
 */
import { watch } from 'node:fs'
import { appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOG = join(ROOT, 'docs', 'activity-watch.log')
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'out',
  'release',
  '.vite',
  'coverage',
  '.playwright-cli',
  'docs', // our own log lives here; avoid feedback loops
])
const DEBOUNCE_MS = 1500
const pending = new Map()

mkdirSync(dirname(LOG), { recursive: true })

function write(entry) {
  try {
    appendFileSync(LOG, `${entry}\n`)
  } catch (err) {
    console.error(`[memory-watcher] write failed: ${err.message}`)
  }
}

function isIgnored(rel) {
  if (!rel) return true
  const top = rel.split(/[\\/]/)[0]
  if (IGNORED_DIRS.has(top)) return true
  if (rel.endsWith('activity-watch.log')) return true
  return false
}

function handleChange(eventType, filename) {
  if (!filename) return
  const rel = relative(ROOT, filename).replaceAll('\\', '/')
  if (isIgnored(rel)) return

  // Debounce per path so burst saves collapse into one entry
  const key = rel
  if (pending.has(key)) clearTimeout(pending.get(key))
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key)
      write(`[${new Date().toISOString()}] ${eventType}: ${rel}`)
    }, DEBOUNCE_MS),
  )
}

let watcher
try {
  watcher = watch(ROOT, { recursive: true }, handleChange)
} catch (err) {
  console.error(`[memory-watcher] recursive watch failed on this platform: ${err.message}`)
  console.error('Fallback: watch src/, tests/, and shared/ individually.')
  watcher = ['src', 'tests', 'shared', 'public'].map((d) =>
    watch(join(ROOT, d), { recursive: true }, handleChange),
  )
}

console.log(`[memory-watcher] watching ${ROOT}`)
console.log(`[memory-watcher] logging to ${LOG}`)
console.log('[memory-watcher] Ctrl+C to stop')

process.on('SIGINT', () => {
  for (const p of pending.values()) clearTimeout(p)
  if (Array.isArray(watcher)) watcher.forEach((w) => w.close())
  else watcher.close()
  process.exit(0)
})
