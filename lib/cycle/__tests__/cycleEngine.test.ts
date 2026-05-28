import {
  getDaysInMonth,
  nextMonthPhase,
  generateFulltimeMonth,
  generateParttimeMonth,
} from '../cycleEngine'
import type { Operator } from '@/lib/types'

// Helper to build a minimal fulltime operator
function ftOp(phase: number, cycle = ['R','M1','M2','P1','N1','N2']): Operator {
  return {
    id: 'op1', name: 'Test', nucleoId: 'nucleo-b',
    contractType: 'fulltime', active: true,
    cycle, cyclePhase: phase, cycleMonth: '2026-06',
  }
}

// Helper for part-time
function ptOp(pattern: string[]): Operator {
  return {
    id: 'op2', name: 'PT', nucleoId: 'nucleo-b',
    contractType: 'parttime', active: true,
    weeklyPattern: pattern,
  }
}

describe('getDaysInMonth', () => {
  it('returns 30 for June 2026', () => {
    expect(getDaysInMonth(2026, 6)).toBe(30)
  })
  it('returns 31 for May 2026', () => {
    expect(getDaysInMonth(2026, 5)).toBe(31)
  })
  it('returns 28 for Feb 2026 (non-leap)', () => {
    expect(getDaysInMonth(2026, 2)).toBe(28)
  })
  it('returns 29 for Feb 2028 (leap)', () => {
    expect(getDaysInMonth(2028, 2)).toBe(29)
  })
})

describe('nextMonthPhase', () => {
  it('May (31 days) phase 5 → June phase 0', () => {
    // (5 + 31) % 6 = 36 % 6 = 0
    expect(nextMonthPhase(5, 31)).toBe(0)
  })
  it('June (30 days) phase 0 → July phase 0', () => {
    // (0 + 30) % 6 = 30 % 6 = 0
    expect(nextMonthPhase(0, 30)).toBe(0)
  })
  it('July (31 days) phase 0 → August phase 1', () => {
    // (0 + 31) % 6 = 31 % 6 = 1
    expect(nextMonthPhase(0, 31)).toBe(1)
  })
  it('wraps correctly for all phases', () => {
    for (let p = 0; p < 6; p++) {
      const result = nextMonthPhase(p, 30)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(6)
    }
  })
})

describe('generateFulltimeMonth', () => {
  it('returns empty object if operator has no cycle', () => {
    const op: Operator = { id: 'x', name: 'x', nucleoId: 'n', contractType: 'fulltime', active: true }
    expect(generateFulltimeMonth(op, 2026, 6)).toEqual({})
  })

  it('day 1 gets cycle[phase]', () => {
    // phase=0 → cycle[0]='R'
    const result = generateFulltimeMonth(ftOp(0), 2026, 6)
    expect(result[1]).toBe('R')
  })

  it('day 2 gets cycle[(phase+1)%6]', () => {
    // phase=0 → cycle[1]='M1'
    const result = generateFulltimeMonth(ftOp(0), 2026, 6)
    expect(result[2]).toBe('M1')
  })

  it('generates 30 entries for June', () => {
    const result = generateFulltimeMonth(ftOp(0), 2026, 6)
    expect(Object.keys(result).length).toBe(30)
    expect(result[30]).toBeDefined()
  })

  it('Sonila (phase=0) day 5 = N1, day 6 = N2, day 7 = R', () => {
    // cycle=['R','M1','P1','P2','N1','N2'], phase=0
    const sonila = ftOp(0, ['R','M1','P1','P2','N1','N2'])
    const result = generateFulltimeMonth(sonila, 2026, 6)
    expect(result[1]).toBe('R')
    expect(result[2]).toBe('M1')
    expect(result[3]).toBe('P1')
    expect(result[4]).toBe('P2')
    expect(result[5]).toBe('N1')
    expect(result[6]).toBe('N2')
    expect(result[7]).toBe('R') // cycle restarts
    expect(result[11]).toBe('N1') // N1 again 6 days later
    expect(result[17]).toBe('N1') // and again
    expect(result[23]).toBe('N1') // and again
  })

  it('Betty (phase=4) day 1 = N1, day 2 = N2, day 3 = R', () => {
    const betty = ftOp(4)
    const result = generateFulltimeMonth(betty, 2026, 6)
    expect(result[1]).toBe('N1')
    expect(result[2]).toBe('N2')
    expect(result[3]).toBe('R')
  })
})

describe('generateParttimeMonth', () => {
  it('returns empty if operator has no weeklyPattern', () => {
    const op: Operator = { id: 'x', name: 'x', nucleoId: 'n', contractType: 'parttime', active: true }
    expect(generateParttimeMonth(op, 2026, 6)).toEqual({})
  })

  it('June 2026 starts on Monday (index 0), day 1 gets pattern[0]', () => {
    const pattern = ['M_PT','M_PT','M_PT','M_PT','M_PT','R','R']
    const result = generateParttimeMonth(ptOp(pattern), 2026, 6)
    // June 1 = Monday = pattern[0]
    expect(result[1]).toBe('M_PT')
    // June 7 = Sunday = pattern[6]
    expect(result[7]).toBe('R')
    // June 8 = Monday = pattern[0]
    expect(result[8]).toBe('M_PT')
  })

  it('generates 30 entries for June', () => {
    const pattern = ['M_PT','M_PT','R','M_PT','M_PT','R','R']
    const result = generateParttimeMonth(ptOp(pattern), 2026, 6)
    expect(Object.keys(result).length).toBe(30)
  })
})
