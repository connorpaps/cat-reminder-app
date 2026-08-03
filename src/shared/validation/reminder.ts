import type { CreateReminderInput, ReminderKind } from '../types/reminder'

const kinds = new Set<ReminderKind>(['timed', 'all-day', 'anytime'])

export function validateReminderInput(input: CreateReminderInput): string[] {
  const errors: string[] = []
  const kind = input.kind ?? 'timed'
  if (!kinds.has(kind)) errors.push('Choose a valid reminder kind.')

  if (!input.title.trim()) errors.push('A title is required.')
  if (input.title.trim().length > 160) errors.push('Title must be 160 characters or fewer.')

  // `anytime` tasks have no date; `timed`/`all-day` both carry a start time.
  if (kind === 'anytime') {
    if (input.startAt !== undefined && Number.isNaN(new Date(input.startAt).getTime())) errors.push('Choose a valid start time.')
  } else if (input.startAt === undefined || Number.isNaN(new Date(input.startAt).getTime())) {
    errors.push('Choose a valid start time.')
  }
  if (input.endAt && Number.isNaN(new Date(input.endAt).getTime())) errors.push('Choose a valid end time.')
  if (input.endAt && input.startAt && new Date(input.endAt) < new Date(input.startAt)) errors.push('End time must be after the start time.')
  if (input.repeatRule && kind !== 'timed') errors.push('Recurrence is only supported for timed reminders.')

  return errors
}
