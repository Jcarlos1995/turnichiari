import { generateNuovaMatrice } from '../nuovaMatrice'
import type { ShiftType, ContractType } from '@/lib/types'

const CATALOG: ShiftType[] = [
  { code: 'M1', label: 'M1', startTime: '06:30', endTime: '13:30', color: '#a', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'M2', label: 'M2', startTime: '07:00', endTime: '14:00', color: '#b', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'MP', label: 'MP', startTime: '07:00', endTime: '12:00', color: '#c', operatorsPerDay: 1, isPartTime: true, isSystem: false },
  { code: 'P1', label: 'P1', startTime: '14:00', endTime: '21:00', color: '#d', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'P2', label: 'P2', startTime: '14:30', endTime: '21:00', color: '#e', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'N1', label: 'N1', startTime: '21:00', endTime: '00:00', color: '#f', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'N2', label: 'N2', startTime: '00:00', endTime: '06:30', color: '#g', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'R', label: 'Riposo', startTime: '', endTime: '', color: '#h', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'F', label: 'Ferie', startTime: '', endTime: '', color: '#i', operatorsPerDay: 0, isPartTime: false, isSystem: true },
]

function ops(nFT: number, nPT: number) {
  const out: { id: string; contractType: ContractType }[] = []
  for (let i = 0; i < nFT; i++) out.push({ id: `ft${i}`, contractType: 'fulltime' })
  for (let i = 0; i < nPT; i++) out.push({ id: `pt${i}`, contractType: 'parttime' })
  return out
}

function countOnDay(matrice: Record<string, Record<number, string>>, day: number, code: string): number {
  return Object.values(matrice).filter(days => days[day] === code).length
}

describe('generateNuovaMatrice', () => {
  it('covers each shift on day 1 with sufficient staff', () => {
    const { matrice } = generateNuovaMatrice({
      operators: ops(12, 2), year: 2026, month: 6, exceptions: [], shiftCatalog: CATALOG,
    })
    expect(countOnDay(matrice, 1, 'N1')).toBe(1)
    expect(countOnDay(matrice, 1, 'M1')).toBe(2)
    expect(countOnDay(matrice, 1, 'M2')).toBe(1)
    expect(countOnDay(matrice, 1, 'MP')).toBe(1)
    expect(countOnDay(matrice, 1, 'P1')).toBe(1)
    expect(countOnDay(matrice, 1, 'P2')).toBe(2)
  })

  it('places the night block N1→N2→R for the night operator', () => {
    const { matrice } = generateNuovaMatrice({
      operators: ops(12, 2), year: 2026, month: 6, exceptions: [], shiftCatalog: CATALOG,
    })
    const nightOpId = Object.keys(matrice).find(id => matrice[id][1] === 'N1')!
    expect(matrice[nightOpId][2]).toBe('N2')
    expect(matrice[nightOpId][3]).toBe('R')
  })

  it('never auto-assigns a night to a part-time operator', () => {
    const { matrice } = generateNuovaMatrice({
      operators: ops(12, 2), year: 2026, month: 6, exceptions: [], shiftCatalog: CATALOG,
    })
    for (let d = 1; d <= 30; d++) {
      expect(countOnDay({ pt0: matrice.pt0, pt1: matrice.pt1 }, d, 'N1')).toBe(0)
    }
  })

  it('honors exceptions: blocked days carry the exception code', () => {
    const { matrice } = generateNuovaMatrice({
      operators: ops(12, 2), year: 2026, month: 6,
      exceptions: [{ operatorId: 'ft0', code: 'F', fromDay: 5, toDay: 7 }],
      shiftCatalog: CATALOG,
    })
    expect(matrice.ft0[5]).toBe('F')
    expect(matrice.ft0[6]).toBe('F')
    expect(matrice.ft0[7]).toBe('F')
  })

  it('never assigns more than 3 consecutive identical day shifts to an operator', () => {
    const { matrice } = generateNuovaMatrice({
      operators: ops(12, 2), year: 2026, month: 6, exceptions: [], shiftCatalog: CATALOG,
    })
    const DAY_CODES = ['M1', 'M2', 'MP', 'P1', 'P2']
    for (const days of Object.values(matrice)) {
      let runCode: string | null = null
      let runLen = 0
      for (let d = 1; d <= 30; d++) {
        const c = days[d]
        if (c === runCode) runLen++
        else { runCode = c; runLen = 1 }
        if (DAY_CODES.includes(c)) expect(runLen).toBeLessThanOrEqual(3)
      }
    }
  })

  it('reports uncovered slots when staff is insufficient', () => {
    const { report } = generateNuovaMatrice({
      operators: ops(2, 0), year: 2026, month: 6, exceptions: [], shiftCatalog: CATALOG,
    })
    expect(report.uncovered.length).toBeGreaterThan(0)
  })
})
