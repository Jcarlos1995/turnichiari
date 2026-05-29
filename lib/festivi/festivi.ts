/**
 * Computes Easter Sunday for a given year (Gregorian / Anonymous Gregorian algorithm).
 * Returns { month, day } with month 1-based (3 = March, 4 = April).
 */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

const FIXED_HOLIDAYS = new Set([
  '1-1', '1-6', '4-25', '5-1', '6-2', '8-15', '11-1', '12-8', '12-25', '12-26',
])

/**
 * Returns true if the date is a "festivo" for banca-ore purposes:
 * a Sunday OR an Italian national holiday (fixed list + Easter Monday).
 * Saturdays are NOT festivi.
 */
export function isFestivo(date: Date): boolean {
  if (date.getDay() === 0) return true // domenica

  const month = date.getMonth() + 1
  const day = date.getDate()
  if (FIXED_HOLIDAYS.has(`${month}-${day}`)) return true

  const easter = easterSunday(date.getFullYear())
  const pasquetta = new Date(date.getFullYear(), easter.month - 1, easter.day + 1)
  return month === pasquetta.getMonth() + 1 && day === pasquetta.getDate()
}
