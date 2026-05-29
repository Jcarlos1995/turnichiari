import { isFestivo, easterSunday } from '../festivi'

describe('easterSunday', () => {
  it('computes Easter Sunday (Gregorian)', () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 })
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 })
  })
})

describe('isFestivo', () => {
  it('marks Sundays as festivo', () => {
    expect(isFestivo(new Date(2026, 4, 3))).toBe(true) // 3 maggio 2026 = domenica
  })
  it('does NOT mark Saturdays', () => {
    expect(isFestivo(new Date(2026, 4, 2))).toBe(false) // 2 maggio 2026 = sabato
  })
  it('does NOT mark a regular weekday', () => {
    expect(isFestivo(new Date(2026, 4, 4))).toBe(false) // 4 maggio 2026 = lunedì
  })
  it('marks fixed national holidays', () => {
    expect(isFestivo(new Date(2026, 0, 1))).toBe(true)   // Capodanno
    expect(isFestivo(new Date(2026, 0, 6))).toBe(true)   // Epifania
    expect(isFestivo(new Date(2026, 3, 25))).toBe(true)  // Liberazione
    expect(isFestivo(new Date(2026, 4, 1))).toBe(true)   // Festa lavoro
    expect(isFestivo(new Date(2026, 7, 15))).toBe(true)  // Ferragosto
    expect(isFestivo(new Date(2026, 11, 25))).toBe(true) // Natale
  })
  it('marks Pasquetta (Easter Monday)', () => {
    expect(isFestivo(new Date(2026, 3, 6))).toBe(true)   // 6 aprile 2026 = Lunedì dell'Angelo
  })
})
