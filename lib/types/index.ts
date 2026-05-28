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
  { code: 'R',   label: 'Riposo',      startTime: '', endTime: '', color: '#f1f5f9', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'F',   label: 'Ferie',       startTime: '', endTime: '', color: '#dcfce7', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'ML',  label: 'Malattia',    startTime: '', endTime: '', color: '#fee2e2', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'PE',  label: 'Permesso',    startTime: '', endTime: '', color: '#ede9fe', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: '104', label: 'L.104',       startTime: '', endTime: '', color: '#f3e8ff', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'CO',  label: 'Congedo',     startTime: '', endTime: '', color: '#fce7f3', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'INF', label: 'Infortunio',  startTime: '', endTime: '', color: '#fff7ed', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'LU',  label: 'Lutto',       startTime: '', endTime: '', color: '#f4f4f5', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'AS',  label: 'Aspettativa', startTime: '', endTime: '', color: '#fafaf9', operatorsPerDay: 0, isPartTime: false, isSystem: true },
]

/** Default 6-position cycle. Positions 1–3 can be overridden per operator. */
export const DEFAULT_CYCLE: [string, string, string, string, string, string] =
  ['R', 'M1', 'M2', 'P1', 'N1', 'N2']

export const N1_SHIFT: ShiftType = {
  code: 'N1', label: 'Notte 1', startTime: '21:00', endTime: '00:00',
  color: '#dbeafe', operatorsPerDay: 1, isPartTime: false, isSystem: false,
}

export const N2_SHIFT: ShiftType = {
  code: 'N2', label: 'Notte 2', startTime: '00:00', endTime: '06:30',
  color: '#bfdbfe', operatorsPerDay: 1, isPartTime: false, isSystem: false,
}

export type ContractType = 'fulltime' | 'parttime' | 'standard' | 'autosostituzione'

export interface Operator {
  id: string
  name: string
  nucleoId: string
  contractType: ContractType
  active: boolean
  // Full-time cycle fields
  cycle?: string[]        // 6 shift codes, e.g. ['R','M1','M2','P1','N1','N2']
  cyclePhase?: number     // 0–5: position in cycle on day 1 of cycleMonth
  cycleMonth?: string     // 'YYYY-MM' the phase refers to
  // Part-time weekly pattern
  weeklyPattern?: string[] // 7 codes indexed Mon=0 … Sun=6
  // Certifications
  hasFSCertification?: boolean  // ★ certified fire safety officer
}

export interface MatriceDayEntry {
  code: string
  note?: string
  updatedAt?: number
  updatedBy?: string
  isManualOverride?: boolean  // true when RAA manually changed a generated cell
  originalCode?: string       // previous code before manual override
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
