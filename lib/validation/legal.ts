import type { ShiftType } from '@/lib/types'
import { NIGHT } from '@/lib/shifts/nightShift'

export interface LegalViolation {
  rule: 'MIN_REST_11H' | 'WEEKLY_REST' | 'MAX_WEEKLY_HOURS'
  message: string
  hoursAvailable?: number
  hoursRequired?: number
}

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function shiftDurationMinutes(shift: ShiftType): number {
  if (!shift.startTime || !shift.endTime) return 0
  const start = parseTime(shift.startTime)
  let end = parseTime(shift.endTime)
  if (end <= start) end += 24 * 60 // crosses midnight (e.g. N: 21:00-06:30)
  return end - start
}

/**
 * Calculates rest minutes between two consecutive-day shifts.
 * Shifts are always on consecutive days in the schedule grid, so
 * the gap is always measured from prevEnd to nextStart on the following day.
 * Special case: if nextStart === prevEnd, the shifts are back-to-back (0 rest).
 */
function restMinutesBetween(prev: ShiftType, next: ShiftType): number {
  if (!prev.endTime || !next.startTime) return 24 * 60
  const prevEnd = parseTime(prev.endTime)
  const nextStart = parseTime(next.startTime)

  // Back-to-back: night shift ends exactly when next shift starts (e.g. N 21:00-06:30 → M1 06:30-13:30)
  if (nextStart === prevEnd) return 0

  // Consecutive-day gap: always (24h - prevEnd) + nextStart
  // e.g. P2 ends 21:00, M1 starts 06:30 next day: (1440-1260)+390 = 570 min = 9.5h
  // e.g. M1 ends 13:30, P2 starts 14:30 next day: (1440-810)+870 = 1500 min = 25h
  return (24 * 60 - prevEnd) + nextStart
}

export function checkMinRestBetweenShifts(
  prevShift: ShiftType,
  nextShift: ShiftType
): LegalViolation | null {
  if (prevShift.isSystem || nextShift.isSystem) return null

  // N1→N2 is one continuous night shift crossing midnight — no rest check needed
  if (prevShift.code === NIGHT.start && nextShift.code === NIGHT.smonto) return null

  const restMinutes = restMinutesBetween(prevShift, nextShift)
  const restHours = restMinutes / 60
  const MIN_HOURS = 11

  if (restHours < MIN_HOURS) {
    return {
      rule: 'MIN_REST_11H',
      message: `Riposo insufficiente: ${restHours.toFixed(1)}h disponibili, minimo 11h richieste (D.Lgs. 66/2003).`,
      hoursAvailable: restHours,
      hoursRequired: MIN_HOURS,
    }
  }
  return null
}

export function checkWeeklyRest(weekCodes: string[]): LegalViolation | null {
  const REST_CODES = new Set(['R', 'F', 'CO', 'ML', 'AS'])
  const hasRest = weekCodes.some(c => REST_CODES.has(c))
  if (!hasRest) {
    return {
      rule: 'WEEKLY_REST',
      message:
        'Nessun giorno di riposo nella settimana. Almeno 1 riposo obbligatorio ogni 7 giorni (Art. 36 Costituzione).',
    }
  }
  return null
}

export function checkWeeklyHours(shifts: ShiftType[]): LegalViolation | null {
  const totalMinutes = shifts
    .filter(s => !s.isSystem)
    .reduce((sum, s) => sum + shiftDurationMinutes(s), 0)
  const totalHours = totalMinutes / 60
  if (totalHours > 48) {
    return {
      rule: 'MAX_WEEKLY_HOURS',
      message: `Ore settimanali eccedenti: ${totalHours.toFixed(1)}h (max 48h, D.Lgs. 66/2003).`,
      hoursAvailable: totalHours,
      hoursRequired: 48,
    }
  }
  return null
}

export function getViolationsForCell(
  prevShift: ShiftType | null,
  newShift: ShiftType,
  weekShifts: ShiftType[]
): LegalViolation[] {
  const violations: LegalViolation[] = []
  if (prevShift) {
    const restViolation = checkMinRestBetweenShifts(prevShift, newShift)
    if (restViolation) violations.push(restViolation)
  }
  const weekWithNew = [...weekShifts.slice(0, -1), newShift]
  const weekCodes = weekWithNew.map(s => s.code)
  const weeklyRestViolation = checkWeeklyRest(weekCodes)
  if (weeklyRestViolation) violations.push(weeklyRestViolation)
  const weeklyHoursViolation = checkWeeklyHours(weekWithNew)
  if (weeklyHoursViolation) violations.push(weeklyHoursViolation)
  return violations
}
