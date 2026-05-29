import { getDaysInMonth } from '@/lib/cycle/cycleEngine'

/** Single source of truth for the night-shift pair codes. */
export const NIGHT = { start: 'N1', smonto: 'N2' } as const

/**
 * Given the day a night shift starts (N1), returns where its smonto (N2) goes:
 * normally the next day, but day 1 of the next month if N1 is on the last day,
 * and Jan 1 of the next year if N1 is on Dec 31. `month` is 1-based.
 */
export function nextSmontoTarget(
  year: number,
  month: number,
  day: number
): { year: number; month: number; day: number } {
  const daysInMonth = getDaysInMonth(year, month)
  if (day < daysInMonth) {
    return { year, month, day: day + 1 }
  }
  if (month < 12) {
    return { year, month: month + 1, day: 1 }
  }
  return { year: year + 1, month: 1, day: 1 }
}
