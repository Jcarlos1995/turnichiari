import { getDaysInMonth } from '@/lib/cycle/cycleEngine'
import { isFestivo } from '@/lib/festivi/festivi'
import type { ContractType } from '@/lib/types'

const FT_WEEKLY_TARGET = 40
const PT_WEEKLY_TARGET = 28
const FT_RECOVERY_HOURS = 8     // ore sottratte da una cella BO (40/5)
const PT_RECOVERY_HOURS = 5.6   // ore sottratte da una cella RC (28/5)

/** Recovery cell code per contract: FT recupera con 'BO', PT con 'RC'. */
export const RECOVERY_CODE = { ft: 'BO', pt: 'RC' } as const

export interface BancaOreResult {
  accrualFestivo: number
  accrualStraord: number
  usage: number
  delta: number    // accrualFestivo + accrualStraord - usage
  closing: number  // carryIn + delta + manualAdjust
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Groups the days of a month into Monday–Sunday weeks (partial weeks at borders). */
export function weeksOfMonth(year: number, month: number): number[][] {
  const days = getDaysInMonth(year, month)
  const weeks: number[][] = []
  let current: number[] = []
  for (let d = 1; d <= days; d++) {
    const weekdayMon = (new Date(year, month - 1, d).getDay() + 6) % 7 // Mon=0 … Sun=6
    if (weekdayMon === 0 && current.length) {
      weeks.push(current)
      current = []
    }
    current.push(d)
  }
  if (current.length) weeks.push(current)
  return weeks
}

function isPartTime(ct: ContractType): boolean {
  return ct === 'parttime'
}

/**
 * Computes the banca-ore (FT) / riposo-compensativo (PT) hours balance for one
 * operator in one month. Pure: no Firestore. operatorDays maps day → shift code.
 */
export function computeBancaOre(params: {
  contractType: ContractType
  operatorDays: Record<number, string>
  year: number
  month: number
  carryIn: number
  manualAdjust: number
  hoursByCode: Record<string, number>
}): BancaOreResult {
  const pt = isPartTime(params.contractType)
  const weeklyTarget = pt ? PT_WEEKLY_TARGET : FT_WEEKLY_TARGET
  const recoveryCode = pt ? RECOVERY_CODE.pt : RECOVERY_CODE.ft
  const recoveryHours = pt ? PT_RECOVERY_HOURS : FT_RECOVERY_HOURS

  const days = getDaysInMonth(params.year, params.month)

  let accrualFestivo = 0
  let usage = 0
  for (let d = 1; d <= days; d++) {
    const code = params.operatorDays[d]
    if (!code) continue
    if (code === recoveryCode) { usage += recoveryHours; continue }
    const h = params.hoursByCode[code] ?? 0
    if (h > 0 && isFestivo(new Date(params.year, params.month - 1, d))) {
      accrualFestivo += h
    }
  }

  let accrualStraord = 0
  for (const week of weeksOfMonth(params.year, params.month)) {
    let nonFestiveWorked = 0
    for (const d of week) {
      const code = params.operatorDays[d]
      if (!code || code === recoveryCode) continue
      const h = params.hoursByCode[code] ?? 0
      if (h > 0 && !isFestivo(new Date(params.year, params.month - 1, d))) {
        nonFestiveWorked += h
      }
    }
    const target = weeklyTarget * (week.length / 7)
    accrualStraord += Math.max(0, nonFestiveWorked - target)
  }

  const delta = round2(accrualFestivo + accrualStraord - usage)
  const closing = round2(params.carryIn + delta + params.manualAdjust)
  return {
    accrualFestivo: round2(accrualFestivo),
    accrualStraord: round2(accrualStraord),
    usage: round2(usage),
    delta,
    closing,
  }
}
