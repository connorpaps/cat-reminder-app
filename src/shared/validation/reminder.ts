import type { CreateReminderInput } from '../types/reminder'

export function validateReminderInput(input: CreateReminderInput): string[] {
  const errors: string[] = []
  if (!input.title.trim()) errors.push('A title is required.')
  if (input.title.trim().length > 160) errors.push('Title must be 160 characters or fewer.')
  if (Number.isNaN(new Date(input.startAt).getTime())) errors.push('Choose a valid start time.')
  if (input.endAt && Number.isNaN(new Date(input.endAt).getTime())) errors.push('Choose a valid end time.')
  if (input.endAt && new Date(input.endAt) < new Date(input.startAt)) errors.push('End time must be after the start time.')
  return errors
}
