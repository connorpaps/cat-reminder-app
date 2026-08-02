import { isAfter } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { RecurrenceRule } from '../types/reminder'

const positiveInterval = (value: number | undefined): number => Math.max(1, value ?? 1)

type WallClockParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
}

function validTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone }).format()
    return true
  } catch {
    return false
  }
}

function wallClockParts(date: Date, timeZone: string): WallClockParts {
  const values = formatInTimeZone(date, timeZone, 'yyyy-MM-dd-HH-mm-ss').split('-').map(Number)
  const milliseconds = Number(formatInTimeZone(date, timeZone, 'SSS'))
  const [year, month, day, hour, minute, second] = values
  return { year, month, day, hour, minute, second, millisecond: milliseconds }
}

function wallDate(parts: WallClockParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond))
}

function addWallDays(wall: Date, days: number): Date {
  return new Date(Date.UTC(
    wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + days,
    wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds(), wall.getUTCMilliseconds()
  ))
}

function toUtc(wall: Date, timeZone: string): Date {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0')
  const wallClock = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}.${pad(wall.getUTCMilliseconds(), 3)}`
  return fromZonedTime(wallClock, timeZone)
}

function nextDaily(startWall: Date, rule: Extract<RecurrenceRule, { frequency: 'daily' }>, timeZone: string, after: Date): Date {
  let candidateWall = startWall
  const interval = positiveInterval(rule.interval)
  while (!isAfter(toUtc(candidateWall, timeZone), after)) candidateWall = addWallDays(candidateWall, interval)
  return toUtc(candidateWall, timeZone)
}

function nextMonthly(startParts: WallClockParts, rule: Extract<RecurrenceRule, { frequency: 'monthly' }>, timeZone: string, after: Date): Date {
  const interval = positiveInterval(rule.interval)
  const targetDay = rule.dayOfMonth ?? startParts.day
  let monthIndex = startParts.year * 12 + (startParts.month - 1)
  while (true) {
    const year = Math.floor(monthIndex / 12)
    const month = monthIndex % 12
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const candidateWall = wallDate({ ...startParts, year, month: month + 1, day: Math.min(targetDay, lastDay) })
    const candidate = toUtc(candidateWall, timeZone)
    if (isAfter(candidate, after)) return candidate
    monthIndex += interval
  }
}

function nextWeekly(startWall: Date, rule: Extract<RecurrenceRule, { frequency: 'weekly' }>, timeZone: string, after: Date): Date | null {
  const interval = positiveInterval(rule.interval)
  const days = rule.daysOfWeek?.length ? [...new Set(rule.daysOfWeek)].sort((a, b) => a - b) : [startWall.getUTCDay()]
  for (let week = 0; week < 54; week += 1) {
    const weekStart = addWallDays(startWall, week * 7 * interval)
    const candidates = days
      .map((day) => addWallDays(weekStart, (day - weekStart.getUTCDay() + 7) % 7))
      .sort((left, right) => left.getTime() - right.getTime())
    for (const candidateWall of candidates) {
      const candidate = toUtc(candidateWall, timeZone)
      if (isAfter(candidate, after)) return candidate
    }
  }
  return null
}

export function nextOccurrence(startAt: string, rule: RecurrenceRule, timeZone: string, after = new Date()): string | null {
  const start = new Date(startAt)
  if (Number.isNaN(start.getTime()) || !validTimeZone(timeZone)) return null
  const parts = wallClockParts(start, timeZone)
  const startWall = wallDate(parts)
  const next = rule.frequency === 'daily'
    ? nextDaily(startWall, rule, timeZone, after)
    : rule.frequency === 'monthly'
      ? nextMonthly(parts, rule, timeZone, after)
      : nextWeekly(startWall, rule, timeZone, after)
  return next?.toISOString() ?? null
}

export function occurrenceKey(startAt: string): string { return new Date(startAt).toISOString() }
