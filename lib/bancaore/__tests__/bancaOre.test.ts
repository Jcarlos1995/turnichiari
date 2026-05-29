import { computeBancaOre, weeksOfMonth } from '../bancaOre'

const HOURS = { M1: 7, M2: 7, MP: 5, P1: 7, P2: 6.5, N1: 3, N2: 6.5, R: 0, F: 0, BO: 0, RC: 0 } as Record<string, number>

describe('weeksOfMonth', () => {
  it('groups days Monday–Sunday with partial border weeks', () => {
    // Maggio 2026: 1 maggio = venerdì → prima settimana parziale [1,2,3]
    const weeks = weeksOfMonth(2026, 5)
    expect(weeks[0]).toEqual([1, 2, 3])
    expect(weeks[1]).toEqual([4, 5, 6, 7, 8, 9, 10])
    expect(weeks[weeks.length - 1][weeks[weeks.length - 1].length - 1]).toBe(31)
  })
})

describe('computeBancaOre (full-time)', () => {
  it('accrues Sunday/festivo worked hours 1:1', () => {
    const r = computeBancaOre({
      contractType: 'fulltime', operatorDays: { 3: 'M1' }, // 3 maggio = domenica
      year: 2026, month: 5, carryIn: 0, manualAdjust: 0, hoursByCode: HOURS,
    })
    expect(r.accrualFestivo).toBe(7)
    expect(r.accrualStraord).toBe(0)
    expect(r.closing).toBe(7)
  })

  it('accrues weekly straordinario above 40h (non-festive)', () => {
    const days: Record<number, string> = { 4: 'M1', 5: 'M1', 6: 'M1', 7: 'M1', 8: 'M1', 9: 'M1' }
    const r = computeBancaOre({
      contractType: 'fulltime', operatorDays: days,
      year: 2026, month: 5, carryIn: 0, manualAdjust: 0, hoursByCode: HOURS,
    })
    expect(r.accrualStraord).toBe(2) // 42 - 40
    expect(r.accrualFestivo).toBe(0)
  })

  it('subtracts a BO recovery cell (8h for FT)', () => {
    const r = computeBancaOre({
      contractType: 'fulltime', operatorDays: { 4: 'BO' },
      year: 2026, month: 5, carryIn: 10, manualAdjust: 0, hoursByCode: HOURS,
    })
    expect(r.usage).toBe(8)
    expect(r.closing).toBe(2)
  })

  it('adds carryIn and manualAdjust to closing', () => {
    const r = computeBancaOre({
      contractType: 'fulltime', operatorDays: {},
      year: 2026, month: 5, carryIn: 5, manualAdjust: -2, hoursByCode: HOURS,
    })
    expect(r.closing).toBe(3)
  })
})

describe('computeBancaOre (part-time)', () => {
  it('uses 28h weekly target and RC recovery (5.6h)', () => {
    const days: Record<number, string> = { 4: 'M1', 5: 'M1', 6: 'M1', 7: 'M1', 8: 'M1', 11: 'RC' }
    const r = computeBancaOre({
      contractType: 'parttime', operatorDays: days,
      year: 2026, month: 5, carryIn: 0, manualAdjust: 0, hoursByCode: HOURS,
    })
    expect(r.accrualStraord).toBe(7)
    expect(r.usage).toBe(5.6)
    expect(r.closing).toBe(1.4)
  })
})
