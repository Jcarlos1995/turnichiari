import { checkMinRestBetweenShifts, checkWeeklyRest, LegalViolation } from '../legal'
import type { ShiftType } from '@/lib/types'

const M1: ShiftType = { code: 'M1', label: 'Mattina 1', startTime: '06:30', endTime: '13:30', color: '#fef3c7', operatorsPerDay: 2, isPartTime: false, isSystem: false }
const P2: ShiftType = { code: 'P2', label: 'Pomeriggio 2', startTime: '14:30', endTime: '21:00', color: '#fed7aa', operatorsPerDay: 2, isPartTime: false, isSystem: false }
const N:  ShiftType = { code: 'N',  label: 'Notte', startTime: '21:00', endTime: '06:30', color: '#e0e7ff', operatorsPerDay: 1, isPartTime: false, isSystem: false }
const R:  ShiftType = { code: 'R',  label: 'Riposo', startTime: '', endTime: '', color: '#f1f5f9', operatorsPerDay: 0, isPartTime: false, isSystem: true }

describe('checkMinRestBetweenShifts', () => {
  it('fails when P2 is followed by M1 (21:00 to 06:30 = 9.5h < 11h)', () => {
    const violation = checkMinRestBetweenShifts(P2, M1)
    expect(violation).not.toBeNull()
    expect(violation?.rule).toBe('MIN_REST_11H')
    expect(violation?.hoursAvailable).toBe(9.5)
  })

  it('passes when M1 is followed by P2 (13:30 to 14:30 next day = 25h)', () => {
    const violation = checkMinRestBetweenShifts(M1, P2)
    expect(violation).toBeNull()
  })

  it('fails when N is followed by M1 (06:30 to 06:30 = 0h)', () => {
    const violation = checkMinRestBetweenShifts(N, M1)
    expect(violation).not.toBeNull()
    expect(violation?.rule).toBe('MIN_REST_11H')
    expect(violation?.hoursAvailable).toBe(0)
  })

  it('ignores system shifts in previous position — returns null', () => {
    const violation = checkMinRestBetweenShifts(R, M1)
    expect(violation).toBeNull()
  })
})

describe('checkWeeklyRest', () => {
  it('passes when at least 1 R in 7 days', () => {
    const week = ['M1','M1','R','M1','M1','P2','M1']
    expect(checkWeeklyRest(week)).toBeNull()
  })

  it('fails when no R in 7 days', () => {
    const week = ['M1','M1','M1','M1','M1','P2','N']
    const v = checkWeeklyRest(week)
    expect(v).not.toBeNull()
    expect(v?.rule).toBe('WEEKLY_REST')
  })
})
