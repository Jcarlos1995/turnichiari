import { getDaysInMonth } from '@/lib/cycle/cycleEngine'
import { weeksOfMonth } from '@/lib/bancaore/bancaOre'
import { shiftDurationHours } from '@/lib/shifts/shiftHours'
import { checkMinRestBetweenShifts } from '@/lib/validation/legal'
import type { ContractType, ShiftType } from '@/lib/types'

/** Required headcount per day shift (fixed, 7 days a week). */
export const DAY_COVERAGE: Record<string, number> = { P2: 2, M1: 2, M2: 1, P1: 1, MP: 1 }
/** Fill order: scarce (2-people) shifts first. */
export const DAY_SLOT_ORDER = ['P2', 'M1', 'M2', 'P1', 'MP']
export const NIGHT_START = 'N1'
export const NIGHT_SMONTO = 'N2'
const MAX_WEEKLY_HOURS = 48
const MAX_CONSECUTIVE_WORK = 6

export interface GeneraOperator { id: string; contractType: ContractType }
export interface ExceptionRange { operatorId: string; code: string; fromDay: number; toDay: number }
export interface UncoveredSlot { day: number; shift: string; missing: number }
export interface GenerationReport { uncovered: UncoveredSlot[] }
export interface GenerationOutput {
  matrice: Record<string, Record<number, string>>
  report: GenerationReport
}

export function generateNuovaMatrice(params: {
  operators: GeneraOperator[]
  year: number
  month: number
  exceptions: ExceptionRange[]
  shiftCatalog: ShiftType[]
}): GenerationOutput {
  const { operators, year, month, exceptions, shiftCatalog } = params
  const N = getDaysInMonth(year, month)

  const typeByCode: Record<string, ShiftType> = {}
  const hours: Record<string, number> = {}
  for (const s of shiftCatalog) { typeByCode[s.code] = s; hours[s.code] = shiftDurationHours(s) }

  const weeks = weeksOfMonth(year, month)
  const weekOfDay: Record<number, number> = {}
  weeks.forEach((w, i) => w.forEach(d => { weekOfDay[d] = i }))
  const weekTarget = (op: GeneraOperator, wi: number) =>
    (op.contractType === 'parttime' ? 28 : 40) * (weeks[wi].length / 7)

  const assigned: Record<string, Record<number, string>> = {}
  const weekHours: Record<string, number[]> = {}
  const nightsWeek: Record<string, number[]> = {}
  const consec: Record<string, number> = {}
  for (const op of operators) {
    assigned[op.id] = {}
    weekHours[op.id] = weeks.map(() => 0)
    nightsWeek[op.id] = weeks.map(() => 0)
    consec[op.id] = 0
  }

  const exDay: Record<string, Record<number, string>> = {}
  for (const ex of exceptions) {
    exDay[ex.operatorId] ??= {}
    for (let d = ex.fromDay; d <= ex.toDay; d++) exDay[ex.operatorId][d] = ex.code
  }

  const isFT = (op: GeneraOperator) => op.contractType !== 'parttime'

  function placeWork(opId: string, d: number, code: string) {
    assigned[opId][d] = code
    weekHours[opId][weekOfDay[d]] += hours[code] ?? 0
  }

  function legalOk(op: GeneraOperator, d: number, code: string): boolean {
    if (assigned[op.id][d]) return false
    if (exDay[op.id]?.[d]) return false
    const prev = assigned[op.id][d - 1]
    if (prev) {
      const pv = typeByCode[prev]
      const nv = typeByCode[code]
      if (pv && nv && checkMinRestBetweenShifts(pv, nv)) return false
    }
    const wi = weekOfDay[d]
    if (weekHours[op.id][wi] + (hours[code] ?? 0) > MAX_WEEKLY_HOURS) return false
    if (consec[op.id] >= MAX_CONSECUTIVE_WORK && (hours[code] ?? 0) > 0) return false
    return true
  }

  function hoursDebt(op: GeneraOperator, d: number): number {
    const wi = weekOfDay[d]
    return weekHours[op.id][wi] - weekTarget(op, wi) // più negativo = più "in debito"
  }

  const uncovered: UncoveredSlot[] = []

  for (let d = 1; d <= N; d++) {
    const wi = weekOfDay[d]

    // 1. eccezioni (e celle già forzate da nottate precedenti)
    for (const op of operators) {
      const ex = exDay[op.id]?.[d]
      if (ex && !assigned[op.id][d]) assigned[op.id][d] = ex
    }

    // 2. notte: 1 FT inizia N1; blocco N1→N2→R
    const nightCandidates = operators.filter(op =>
      isFT(op) &&
      !assigned[op.id][d] &&
      !exDay[op.id]?.[d] &&
      (d + 1 > N || (!assigned[op.id][d + 1] && !exDay[op.id]?.[d + 1])) &&
      legalOk(op, d, NIGHT_START)
    )
    if (nightCandidates.length) {
      nightCandidates.sort((a, b) =>
        (nightsWeek[a.id][wi] - nightsWeek[b.id][wi]) ||
        (hoursDebt(a, d) - hoursDebt(b, d))
      )
      const chosen = nightCandidates[0]
      placeWork(chosen.id, d, NIGHT_START)
      nightsWeek[chosen.id][wi] += 1
      if (d + 1 <= N) placeWork(chosen.id, d + 1, NIGHT_SMONTO)
      if (d + 2 <= N) assigned[chosen.id][d + 2] = 'R'
    } else {
      uncovered.push({ day: d, shift: 'Notte', missing: 1 })
    }

    // 3. posti di giorno
    for (const shift of DAY_SLOT_ORDER) {
      const need = DAY_COVERAGE[shift]
      let filled = 0
      for (let slot = 0; slot < need; slot++) {
        const candidates = operators.filter(op => legalOk(op, d, shift))
        if (!candidates.length) break
        candidates.sort((a, b) => {
          if (shift === 'MP') {
            const pa = a.contractType === 'parttime' ? 0 : 1
            const pb = b.contractType === 'parttime' ? 0 : 1
            if (pa !== pb) return pa - pb
          }
          return hoursDebt(a, d) - hoursDebt(b, d)
        })
        placeWork(candidates[0].id, d, shift)
        filled++
      }
      if (filled < need) uncovered.push({ day: d, shift, missing: need - filled })
    }

    // 4. riposo per i non assegnati
    for (const op of operators) {
      if (!assigned[op.id][d]) assigned[op.id][d] = 'R'
    }

    // 5. aggiorna giorni lavorativi consecutivi
    for (const op of operators) {
      const code = assigned[op.id][d]
      if ((hours[code] ?? 0) > 0) consec[op.id] += 1
      else consec[op.id] = 0
    }
  }

  return { matrice: assigned, report: { uncovered } }
}
