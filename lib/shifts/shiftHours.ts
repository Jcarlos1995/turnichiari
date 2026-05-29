import type { ShiftType } from '@/lib/types'

/** Working hours of a shift, handling shifts that cross midnight. 0 if no times. */
export function shiftDurationHours(shift: ShiftType): number {
  if (!shift.startTime || !shift.endTime) return 0
  const [sh, sm] = shift.startTime.split(':').map(Number)
  const [eh, em] = shift.endTime.split(':').map(Number)
  let start = sh * 60 + sm
  let end = eh * 60 + em
  if (end <= start) end += 24 * 60 // crosses midnight
  return (end - start) / 60
}

/** Builds a { code: hours } map from a list of shift types. */
export function hoursByCode(shiftTypes: ShiftType[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const s of shiftTypes) map[s.code] = shiftDurationHours(s)
  return map
}
