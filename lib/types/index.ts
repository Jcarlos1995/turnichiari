export type UserRole = 'coordinatrice' | 'raa' | 'oss'

export interface AppUser {
  uid: string
  email: string
  name: string
  role: UserRole
  nucleoId: string | null
}

export interface ShiftType {
  code: string
  label: string
  startTime: string
  endTime: string
  color: string
  operatorsPerDay: number
  isPartTime: boolean
  isSystem: boolean
}

export const SYSTEM_SHIFTS: ShiftType[] = [
  { code: 'R',   label: 'Riposo',     startTime: '', endTime: '', color: '#f1f5f9', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'F',   label: 'Ferie',      startTime: '', endTime: '', color: '#dcfce7', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'ML',  label: 'Malattia',   startTime: '', endTime: '', color: '#fee2e2', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'PE',  label: 'Permesso',   startTime: '', endTime: '', color: '#ede9fe', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: '104', label: 'L.104',      startTime: '', endTime: '', color: '#f3e8ff', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'CO',  label: 'Congedo',    startTime: '', endTime: '', color: '#fce7f3', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'INF', label: 'Infortunio', startTime: '', endTime: '', color: '#fff7ed', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'LU',  label: 'Lutto',      startTime: '', endTime: '', color: '#f4f4f5', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'AS',  label: 'Aspettativa',startTime: '', endTime: '', color: '#fafaf9', operatorsPerDay: 0, isPartTime: false, isSystem: true },
]

export interface Operator {
  id: string
  name: string
  nucleoId: string
  contractType: 'standard' | 'autosostituzione'
  active: boolean
}

export interface MatriceDayEntry {
  code: string
  note?: string
  updatedAt?: number
  updatedBy?: string
}

export interface MatriceMonth {
  [operatorId: string]: {
    [day: number]: MatriceDayEntry
  }
}

export interface Nucleo {
  id: string
  name: string
  raaId: string
  shiftTypes: ShiftType[]
}
