import { shiftDurationHours, hoursByCode } from '../shiftHours'
import type { ShiftType } from '@/lib/types'

const mk = (code: string, startTime: string, endTime: string): ShiftType => ({
  code, label: code, startTime, endTime, color: '#fff',
  operatorsPerDay: 1, isPartTime: false, isSystem: false,
})

describe('shiftDurationHours', () => {
  it('computes a normal day shift', () => {
    expect(shiftDurationHours(mk('M1', '06:30', '13:30'))).toBe(7)
    expect(shiftDurationHours(mk('P2', '14:30', '21:00'))).toBe(6.5)
    expect(shiftDurationHours(mk('MP', '07:00', '12:00'))).toBe(5)
  })
  it('handles shifts crossing midnight', () => {
    expect(shiftDurationHours(mk('N1', '21:00', '00:00'))).toBe(3)
    expect(shiftDurationHours(mk('N2', '00:00', '06:30'))).toBe(6.5)
  })
  it('returns 0 for system shifts with no times', () => {
    expect(shiftDurationHours(mk('R', '', ''))).toBe(0)
  })
})

describe('hoursByCode', () => {
  it('builds a code→hours map', () => {
    const map = hoursByCode([mk('M1', '06:30', '13:30'), mk('R', '', '')])
    expect(map).toEqual({ M1: 7, R: 0 })
  })
  it('treats BO and RC system shifts as 0 hours', () => {
    const map = hoursByCode([
      { code: 'BO', label: 'x', startTime: '', endTime: '', color: '#e0f2fe', operatorsPerDay: 0, isPartTime: false, isSystem: true },
      { code: 'RC', label: 'x', startTime: '', endTime: '', color: '#cffafe', operatorsPerDay: 0, isPartTime: false, isSystem: true },
    ])
    expect(map.BO).toBe(0)
    expect(map.RC).toBe(0)
  })
})
