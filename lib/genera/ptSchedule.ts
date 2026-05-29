import { weeksOfMonth } from '@/lib/bancaore/bancaOre'

export type PtPhase = 'A' | 'B'

/** Contractual part-time bi-weekly pattern. Weekday index: Lun=0 … Dom=6. */
export const PT_WEEK_A = ['MP', 'MP', 'MP', 'P2', 'R', 'R', 'MP']
export const PT_WEEK_B = ['M1', 'P2', 'R', 'MP', 'MP', 'MP', 'R']

export function opposite(p: PtPhase): PtPhase {
  return p === 'A' ? 'B' : 'A'
}

/** Phase of a given Mon–Sun week index given the month's first-week phase. */
export function phaseForWeek(startPhase: PtPhase, weekIndex: number): PtPhase {
  return weekIndex % 2 === 0 ? startPhase : opposite(startPhase)
}

/**
 * Continues the A/B alternation across months: given the previous month's
 * first-week phase and its number of Mon–Sun weeks, returns the phase the new
 * month's first week must take so the rotation never breaks.
 */
export function continueStartPhase(prevStartPhase: PtPhase, prevWeekCount: number): PtPhase {
  const prevLast = phaseForWeek(prevStartPhase, prevWeekCount - 1)
  return opposite(prevLast)
}

/**
 * Builds a part-time operator's full month schedule (day → shift code) from a
 * starting phase, alternating A/B by Mon–Sun week and indexing the pattern by weekday.
 */
export function ptMonthSchedule(year: number, month: number, startPhase: PtPhase): Record<number, string> {
  const weeks = weeksOfMonth(year, month)
  const result: Record<number, string> = {}
  weeks.forEach((days, weekIndex) => {
    const phase = phaseForWeek(startPhase, weekIndex)
    const pattern = phase === 'A' ? PT_WEEK_A : PT_WEEK_B
    for (const d of days) {
      const weekday = (new Date(year, month - 1, d).getDay() + 6) % 7 // Mon=0 … Sun=6
      result[d] = pattern[weekday]
    }
  })
  return result
}
