import type { Operator } from '@/lib/types'

/** Returns the number of days in a given month (month is 1-based). */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Calculates the cycle phase for the next month.
 * Formula: (currentPhase + daysInCurrentMonth) % 6
 */
export function nextMonthPhase(currentPhase: number, daysInCurrentMonth: number): number {
  return (currentPhase + daysInCurrentMonth) % 6
}

/**
 * Generates the full month shift schedule for a full-time operator.
 * Returns a map of { dayNumber: shiftCode } for days 1…N.
 * Returns {} if the operator has no cycle or phase configured.
 *
 * Formula: shift on day D = operator.cycle[(operator.cyclePhase + D - 1) % 6]
 */
export function generateFulltimeMonth(
  operator: Operator,
  year: number,
  month: number
): Record<number, string> {
  if (
    operator.contractType !== 'fulltime' ||
    !operator.cycle ||
    operator.cycle.length !== 6 ||
    operator.cyclePhase === undefined
  ) {
    return {}
  }

  const days = getDaysInMonth(year, month)
  const result: Record<number, string> = {}

  for (let d = 1; d <= days; d++) {
    const pos = (operator.cyclePhase + d - 1) % 6
    result[d] = operator.cycle[pos]
  }

  return result
}

/**
 * Generates the full month shift schedule for a part-time operator
 * using a fixed 7-day weekly pattern (Mon=0 … Sun=6).
 * Returns {} if operator has no weeklyPattern.
 */
export function generateParttimeMonth(
  operator: Operator,
  year: number,
  month: number
): Record<number, string> {
  if (operator.contractType !== 'parttime' || !operator.weeklyPattern) {
    return {}
  }

  const days = getDaysInMonth(year, month)
  // getDay() returns 0=Sun, 1=Mon … convert to Mon=0 … Sun=6
  const rawFirstDay = new Date(year, month - 1, 1).getDay()
  const firstWeekday = rawFirstDay === 0 ? 6 : rawFirstDay - 1

  const result: Record<number, string> = {}
  for (let d = 1; d <= days; d++) {
    const weekday = (firstWeekday + d - 1) % 7
    result[d] = operator.weeklyPattern[weekday]
  }
  return result
}
